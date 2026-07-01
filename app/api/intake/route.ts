// ─────────────────────────────────────────────────────────────
//  Mobile-app (PWA) intake endpoint.
//  Accepts multipart/form-data: optional "audio" blob (recorded in the
//  browser) + optional form fields. Transcribes the audio (Whisper),
//  then runs the same ingestion pipeline (parse → match → score →
//  route → nurture). One submit handles form-only, voice-only, or both.
// ─────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { ingestLead } from "@/lib/ingest/ingest";
import { transcribeAudioBuffer } from "@/lib/ingest/transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Cap upload size to avoid abuse (voice notes are small).
const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // 15 MB

export async function POST(req: NextRequest) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "expected multipart/form-data" }, { status: 400 });
  }

  const audio = form.get("audio");
  const str = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };

  // Transcribe the recording if present
  let transcript: string | null = null;
  let transcribeError: string | null = null;
  if (audio && typeof audio !== "string") {
    const file = audio as File;
    if (file.size > MAX_AUDIO_BYTES) {
      return Response.json({ error: "audio too large" }, { status: 413 });
    }
    try {
      const buf = Buffer.from(await file.arrayBuffer());
      transcript = await transcribeAudioBuffer(buf, file.type || "audio/webm");
      if (!transcript) transcribeError = "no_transcription"; // no OPENAI_API_KEY or empty
    } catch (e) {
      console.error("[intake] transcription failed", e);
      transcribeError = "transcription_failed";
    }
  }

  const hasForm = !!(str("fullName") || str("phone") || str("productInterest") || str("notes"));
  if (!transcript && !hasForm) {
    return Response.json(
      { error: "empty", detail: transcribeError ?? "no form fields and no transcript" },
      { status: 400 },
    );
  }

  const { lead, created } = await ingestLead({
    channel: audio && typeof audio !== "string" ? "app_voice" : "app_form",
    from: str("phone"),
    text: str("notes"),
    transcript,
    source: str("source") || "app",
    prefilled: {
      fullName: str("fullName"),
      phone: str("phone"),
      email: str("email"),
      company: str("company"),
      productInterest: str("productInterest"),
    },
    actor: str("actor") || "app",
  });

  return Response.json(
    {
      ok: true,
      id: lead.id,
      created,
      score: lead.score,
      fullName: lead.fullName,
      productInterest: lead.productInterest,
      transcript,
      transcribeError,
    },
    { status: 201 },
  );
}
