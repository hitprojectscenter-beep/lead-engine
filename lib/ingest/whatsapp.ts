// ─────────────────────────────────────────────────────────────
//  Twilio WhatsApp helpers: send an outbound message (auto-reply)
//  and validate inbound webhook signatures. All no-op safely when
//  Twilio credentials are not configured (dev mode).
// ─────────────────────────────────────────────────────────────
import twilio from "twilio";
import { normalizePhone } from "../utils";

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

export const hasTwilio = !!(sid && token);
export const twilioAuth = hasTwilio ? { sid: sid!, token: token! } : undefined;

// Optional allow-list of sender phone numbers (comma-separated in env).
// When set, only these numbers may open leads via the WhatsApp webhook —
// essential for an internal intake tool so strangers can't inject leads.
const allowedSenders = (process.env.WHATSAPP_ALLOWED_SENDERS || "")
  .split(",")
  .map((s) => normalizePhone(s))
  .filter((s): s is string => !!s);

export const whitelistActive = allowedSenders.length > 0;

/** True if this sender may open leads. Open to all when no allow-list is set. */
export function isSenderAllowed(fromAddr?: string | null): boolean {
  if (!whitelistActive) return true;
  const n = normalizePhone(fromAddr);
  return !!n && allowedSenders.includes(n);
}

let client: ReturnType<typeof twilio> | null = null;
function getClient() {
  if (!hasTwilio) return null;
  if (!client) client = twilio(sid!, token!);
  return client;
}

/** Send a WhatsApp message. `to` may be "+9725..." or "whatsapp:+9725...". */
export async function sendWhatsApp(to: string, body: string): Promise<boolean> {
  const c = getClient();
  if (!c) return false;
  const toAddr = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  try {
    await c.messages.create({ from, to: toAddr, body });
    return true;
  } catch (e) {
    console.error("[whatsapp] send failed", e);
    return false;
  }
}

/**
 * Validate a Twilio inbound webhook signature.
 * In dev (no token) we skip validation and allow the request.
 */
export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  if (!hasTwilio) return true; // dev mode — accept
  if (!signature) return false;
  return twilio.validateRequest(token!, signature, url, params);
}
