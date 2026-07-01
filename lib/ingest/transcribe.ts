// ─────────────────────────────────────────────────────────────
//  Voice-note transcription via OpenAI Whisper (Hebrew).
//  Gracefully no-ops (returns null) when OPENAI_API_KEY is unset,
//  so the rest of the ingestion pipeline still works.
// ─────────────────────────────────────────────────────────────
import OpenAI, { toFile } from "openai";

export const hasOpenAI = !!process.env.OPENAI_API_KEY;

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!hasOpenAI) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
export { getClient as getOpenAI };

function extFor(contentType: string): string {
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mp4") || contentType.includes("m4a")) return "mp4";
  if (contentType.includes("webm")) return "webm";
  return "ogg";
}

/** Core: transcribe a raw audio buffer to Hebrew text via Whisper. */
export async function transcribeAudioBuffer(
  buf: Buffer,
  contentType = "audio/ogg",
): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;
  const file = await toFile(buf, `voice.${extFor(contentType)}`, { type: contentType });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "he",
  });
  return result.text?.trim() || null;
}

/**
 * Transcribe an audio file (given as a public URL, e.g. a Twilio media URL)
 * to Hebrew text. Twilio media URLs need Basic auth; pass creds if available.
 */
export async function transcribeAudioUrl(
  url: string,
  auth?: { sid: string; token: string },
): Promise<string | null> {
  if (!hasOpenAI) return null;
  const headers: Record<string, string> = {};
  if (auth) {
    headers.Authorization =
      "Basic " + Buffer.from(`${auth.sid}:${auth.token}`).toString("base64");
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`media fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "audio/ogg";
  return transcribeAudioBuffer(buf, contentType);
}
