// ─────────────────────────────────────────────────────────────
//  Twilio WhatsApp inbound webhook.
//  Point your Twilio WhatsApp sandbox / sender "WHEN A MESSAGE COMES IN"
//  to  POST  {NEXT_PUBLIC_BASE_URL}/api/webhooks/whatsapp
//  Handles text messages AND voice notes (audio media → transcription).
//  Responds with TwiML so the sender gets an instant acknowledgement.
// ─────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { ingestLead } from "@/lib/ingest/ingest";
import { validateTwilioSignature, sendWhatsApp, hasTwilio } from "@/lib/ingest/whatsapp";
import { STATUS_LABELS } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function twiml(message?: string): Response {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(
        message,
      )}</Message></Response>`
    : `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
  return new Response(body, { status: 200, headers: { "Content-Type": "text/xml" } });
}

function escapeXml(s: string): string {
  return s.replace(/[<>&'"]/g, (c) =>
    c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === "&" ? "&amp;" : c === "'" ? "&apos;" : "&quot;",
  );
}

export async function POST(req: NextRequest) {
  const url = req.url;
  const form = await req.formData();
  const params: Record<string, string> = {};
  form.forEach((v, k) => (params[k] = String(v)));

  // Verify the request really came from Twilio (skipped in dev w/o creds)
  const signature = req.headers.get("x-twilio-signature");
  if (!validateTwilioSignature(signature, url, params)) {
    return new Response("invalid signature", { status: 403 });
  }

  const from = params.From ?? params.WaId ?? null;
  const body = params.Body ?? "";
  const numMedia = parseInt(params.NumMedia ?? "0", 10) || 0;

  // Collect media; find the first audio (voice note)
  const mediaUrls: string[] = [];
  let audioUrl: string | null = null;
  for (let i = 0; i < numMedia; i++) {
    const mUrl = params[`MediaUrl${i}`];
    const mType = params[`MediaContentType${i}`] ?? "";
    if (!mUrl) continue;
    mediaUrls.push(mUrl);
    if (!audioUrl && mType.startsWith("audio")) audioUrl = mUrl;
  }

  const channel = audioUrl ? "whatsapp_voice" : "whatsapp_text";

  try {
    const { lead, created, transcript } = await ingestLead({
      channel,
      from,
      text: body || null,
      audioUrl,
      audioIsTwilio: true,
      source: "whatsapp",
      mediaUrls,
      actor: "whatsapp",
    });

    // Build a friendly Hebrew acknowledgement
    const parts: string[] = [];
    parts.push(created ? "✅ הליד נקלט במערכת." : "✅ ההודעה נוספה לליד קיים.");
    if (transcript) parts.push(`📝 תמלול: ${transcript.slice(0, 120)}`);
    if (lead.fullName) parts.push(`👤 ${lead.fullName}`);
    if (lead.productInterest) parts.push(`🎯 ${lead.productInterest}`);
    parts.push(`🔥 ניקוד: ${lead.score}/100 · סטטוס: ${STATUS_LABELS[lead.status]}`);
    if (lead.isExistingCustomer) parts.push("⭐ זוהה כלקוח קיים — הזדמנות הרחבה.");
    const ack = parts.join("\n");

    // In sandbox, TwiML reply is the reliable path; also try REST if configured.
    if (hasTwilio && from) void sendWhatsApp(from, ack);
    return twiml(ack);
  } catch (e) {
    console.error("[whatsapp webhook] error", e);
    return twiml("אירעה שגיאה בקליטת הליד. נסו שוב או פנו לתמיכה.");
  }
}

// Allow a quick GET health-check in the browser
export async function GET() {
  return Response.json({ ok: true, endpoint: "whatsapp-inbound", hasTwilio });
}
