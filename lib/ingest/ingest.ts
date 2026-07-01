// ─────────────────────────────────────────────────────────────
//  Ingestion orchestrator — the heart of the system.
//  Takes a raw inbound from ANY channel and turns it into a fully
//  processed lead: transcribe → parse → match existing customer →
//  score → persist + timeline. One code path for every channel.
// ─────────────────────────────────────────────────────────────
import type { Lead, LeadChannel, ParsedLead } from "../types";
import { store } from "../db/store";
import { scoreLead } from "../scoring/score";
import { parseLead } from "./parse";
import { transcribeAudioUrl } from "./transcribe";
import { twilioAuth } from "./whatsapp";
import { normalizeEmail, normalizePhone } from "../utils";
import { routeLead } from "../routing/route";
import { autoEnroll, stopEnrollments } from "../nurture/enroll";

export interface IngestInput {
  channel: LeadChannel;
  from?: string | null; // sender phone / identifier
  text?: string | null; // message body
  transcript?: string | null; // pre-computed transcript (e.g. from an app upload)
  audioUrl?: string | null; // voice note (Twilio media URL, etc.)
  audioIsTwilio?: boolean; // needs Twilio basic-auth to fetch
  source?: string | null; // campaign / landing slug / referrer
  // Pre-filled fields (e.g. from a landing form) — take precedence over parsing.
  prefilled?: Partial<ParsedLead>;
  mediaUrls?: string[];
  actor?: string;
}

export interface IngestResult {
  lead: Lead;
  created: boolean; // false → merged into an existing open lead
  transcript: string | null;
}

/**
 * Process one inbound and return the resulting lead.
 * De-dupes: if an OPEN lead already exists for the same phone/email,
 * the new message is appended to it instead of creating a duplicate.
 */
export async function ingestLead(input: IngestInput): Promise<IngestResult> {
  const actor = input.actor ?? "system";

  // 1. Transcribe audio if present (or use a transcript supplied by the caller)
  let transcript: string | null = input.transcript ?? null;
  if (!transcript && input.audioUrl) {
    try {
      transcript = await transcribeAudioUrl(
        input.audioUrl,
        input.audioIsTwilio ? twilioAuth : undefined,
      );
    } catch (e) {
      console.error("[ingest] transcription failed", e);
    }
  }

  const rawText = [input.text, transcript].filter(Boolean).join("\n").trim() || null;

  // 2. Extract structured fields (prefilled wins over parsed)
  let parsed: ParsedLead = {
    fullName: null,
    phone: null,
    email: null,
    company: null,
    productInterest: null,
    notes: null,
    temperature: null,
  };
  if (rawText) parsed = await parseLead(rawText);
  if (input.prefilled) parsed = { ...parsed, ...clean(input.prefilled) };

  // Sender phone is a strong contact hint (WhatsApp/phone channels)
  const senderPhone = normalizePhone(input.from);
  const phone = normalizePhone(parsed.phone) ?? senderPhone;
  const email = normalizeEmail(parsed.email);

  // 3. Match existing customer (cross-sell/upsell)
  const customer = await store.findCustomerByContact(phone, email);
  const isExistingCustomer = !!customer;

  // 4. De-dupe against open leads on same contact
  const existing = await findOpenLeadByContact(phone, email);

  const baseFields: Partial<Lead> = {
    fullName: parsed.fullName ?? existing?.fullName ?? customer?.name ?? null,
    phone: phone ?? existing?.phone ?? null,
    email: email ?? existing?.email ?? null,
    company: parsed.company ?? existing?.company ?? customer?.company ?? null,
    productInterest: parsed.productInterest ?? existing?.productInterest ?? null,
    notes: parsed.notes ?? existing?.notes ?? null,
    rawText,
    transcript,
    channel: input.channel,
    source: input.source ?? existing?.source ?? null,
    temperature: parsed.temperature ?? "cold",
    customerId: customer?.id ?? existing?.customerId ?? null,
    isExistingCustomer,
    ownerId: customer?.ownerId ?? existing?.ownerId ?? null,
    mediaUrls: [...(existing?.mediaUrls ?? []), ...(input.mediaUrls ?? [])],
  };

  // 5. Score
  const scored = scoreLead(baseFields);
  baseFields.score = scored.score;
  baseFields.temperature = scored.temperature;
  baseFields.kind = scored.kind;

  // 6. Persist (merge or create)
  let lead: Lead;
  let created: boolean;
  if (existing) {
    lead = (await store.updateLead(existing.id, baseFields))!;
    created = false;
  } else {
    lead = await store.createLead(baseFields);
    created = true;
  }

  // 7. Timeline
  const channelLabelText = input.channel;
  if (created) {
    await store.addActivity({
      leadId: lead.id,
      kind: "ingested",
      actor,
      message: `ליד חדש נקלט מערוץ: ${channelLabelText}`,
      meta: { channel: input.channel, source: input.source },
    });
  } else {
    await store.addActivity({
      leadId: lead.id,
      kind: "ingested",
      actor,
      message: `הודעה נוספת נקלטה ושויכה לליד קיים (ערוץ: ${channelLabelText})`,
    });
  }
  if (transcript) {
    await store.addActivity({
      leadId: lead.id,
      kind: "transcribed",
      actor: "whisper",
      message: `הקלטה תומללה: "${transcript.slice(0, 140)}${transcript.length > 140 ? "…" : ""}"`,
    });
  }
  if (rawText) {
    await store.addActivity({
      leadId: lead.id,
      kind: "parsed",
      actor: "system",
      message: "חולצו פרטי ליד מהטקסט",
      meta: { parsed },
    });
  }
  if (isExistingCustomer) {
    await store.addActivity({
      leadId: lead.id,
      kind: "customer_matched",
      actor: "system",
      message: `זוהה לקוח קיים: ${customer!.name}${
        customer!.products.length ? ` (מחזיק: ${customer!.products.join(", ")})` : ""
      } — הזדמנות Cross-sell/Upsell`,
      meta: { customerId: customer!.id },
    });
  }
  await store.addActivity({
    leadId: lead.id,
    kind: "scored",
    actor: "system",
    message: `ניקוד: ${scored.score}/100 · ${scored.kind.toUpperCase()} · ${scored.temperature}`,
    meta: { reasons: scored.reasons },
  });

  // 8. Auto-route to a rep if still unassigned
  if (!lead.ownerId) {
    const decision = await routeLead(lead, customer?.ownerId);
    if (decision.repId) {
      lead = (await store.updateLead(lead.id, { ownerId: decision.repId })) ?? lead;
      await store.addActivity({
        leadId: lead.id,
        kind: "routed",
        actor: "system",
        message: `נותב לנציג ${decision.repName} — ${decision.reason}`,
        meta: { repId: decision.repId },
      });
    }
  }

  // 9. Nurturing: new lead → auto-enroll in a fitting drip;
  //    an inbound on an EXISTING lead = engagement → pause its drip.
  if (created) {
    await autoEnroll(lead);
  } else {
    await stopEnrollments(lead.id, "התקבלה הודעה נכנסת מהליד");
  }

  return { lead, created, transcript };
}

function clean(p: Partial<ParsedLead>): Partial<ParsedLead> {
  const out: Partial<ParsedLead> = {};
  for (const [k, v] of Object.entries(p)) {
    if (v !== null && v !== undefined && v !== "") (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

async function findOpenLeadByContact(
  phone: string | null,
  email: string | null,
): Promise<Lead | null> {
  if (!phone && !email) return null;
  const all = await store.listLeads();
  return (
    all.find(
      (l) =>
        (l.status !== "won" && l.status !== "lost") &&
        ((phone && normalizePhone(l.phone) === phone) ||
          (email && normalizeEmail(l.email) === email)),
    ) ?? null
  );
}
