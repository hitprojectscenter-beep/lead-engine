// ─────────────────────────────────────────────────────────────
//  Voice-note transcription via OpenAI Whisper (Hebrew).
//  Gracefully no-ops (returns null) when OPENAI_API_KEY is unset,
//  so the rest of the ingestion pipeline still works.
// ─────────────────────────────────────────────────────────────
import OpenAI from "openai";

export const hasOpenAI = !!process.env.OPENAI_API_KEY;

let client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!hasOpenAI) return null;
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return client;
}
export { getClient as getOpenAI };

/**
 * Transcribe an audio file (given as a public URL, e.g. a Twilio media URL)
 * to Hebrew text. Twilio media URLs need Basic auth; pass creds if available.
 */
export async function transcribeAudioUrl(
  url: string,
  auth?: { sid: string; token: string },
): Promise<string | null> {
  const openai = getClient();
  if (!openai) return null;

  const headers: Record<string, string> = {};
  if (auth) {
    headers.Authorization =
      "Basic " + Buffer.from(`${auth.sid}:${auth.token}`).toString("base64");
  }
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`media fetch failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") ?? "audio/ogg";
  const ext = contentType.includes("mpeg")
    ? "mp3"
    : contentType.includes("wav")
      ? "wav"
      : contentType.includes("mp4")
        ? "mp4"
        : "ogg";

  const file = new File([buf], `voice.${ext}`, { type: contentType });
  const result = await openai.audio.transcriptions.create({
    file,
    model: "whisper-1",
    language: "he",
  });
  return result.text?.trim() || null;
}
