// ─────────────────────────────────────────────────────────────
//  Twilio WhatsApp helpers: send an outbound message (auto-reply)
//  and validate inbound webhook signatures. All no-op safely when
//  Twilio credentials are not configured (dev mode).
// ─────────────────────────────────────────────────────────────
import twilio from "twilio";

const sid = process.env.TWILIO_ACCOUNT_SID;
const token = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

export const hasTwilio = !!(sid && token);
export const twilioAuth = hasTwilio ? { sid: sid!, token: token! } : undefined;

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
