"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Radio, Mic, Square, Loader2, CheckCircle2, Trash2, Send, AlertCircle } from "lucide-react";

type Phase = "idle" | "recording" | "recorded";

interface Result {
  id: string;
  score: number;
  fullName: string | null;
  productInterest: string | null;
  transcript: string | null;
  transcribeError: string | null;
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of ["audio/webm", "audio/mp4", "audio/ogg"]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

export default function IntakePage() {
  const [f, setF] = useState({ fullName: "", phone: "", company: "", productInterest: "", notes: "" });
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function startRec() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = pickMime();
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime || "audio/webm" });
        blobRef.current = blob;
        setAudioUrl(URL.createObjectURL(blob));
        setPhase("recorded");
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      recRef.current = rec;
      rec.start();
      setPhase("recording");
      setSeconds(0);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      setError("לא ניתן לגשת למיקרופון. אשרו הרשאה או השתמשו בטופס.");
    }
  }

  function stopRec() {
    if (timerRef.current) clearInterval(timerRef.current);
    recRef.current?.stop();
  }

  function resetRec() {
    blobRef.current = null;
    setAudioUrl(null);
    setPhase("idle");
    setSeconds(0);
  }

  async function submit() {
    setError(null);
    const hasForm = f.fullName || f.phone || f.productInterest || f.notes;
    if (!blobRef.current && !hasForm) {
      setError("מלאו לפחות שדה אחד או הקליטו הודעה.");
      return;
    }
    setBusy(true);
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => v && fd.append(k, v));
    fd.append("source", "app");
    if (blobRef.current) fd.append("audio", blobRef.current, "voice.webm");
    try {
      const r = await fetch("/api/intake", { method: "POST", body: fd });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "failed");
      setResult(data);
    } catch {
      setError("שליחה נכשלה. נסו שוב.");
    }
    setBusy(false);
  }

  function newLead() {
    setResult(null);
    setF({ fullName: "", phone: "", company: "", productInterest: "", notes: "" });
    resetRec();
  }

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 overflow-y-auto bg-slate-50" dir="rtl">
      <div className="mx-auto max-w-md px-4 py-5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
              <Radio size={18} />
            </span>
            <div>
              <div className="font-bold">פתיחת ליד</div>
              <div className="text-xs text-slate-500">טופס מהיר או הקלטה קולית</div>
            </div>
          </div>
          <Link href="/" className="text-xs text-slate-400 hover:text-brand-600">
            ללוח ←
          </Link>
        </div>

        {result ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
            <CheckCircle2 className="mx-auto mb-3 text-green-500" size={52} />
            <h2 className="text-lg font-bold">הליד נוצר!</h2>
            <p className="mt-1 text-sm text-slate-600">
              {result.fullName || "ליד חדש"} · ניקוד {result.score}/100
            </p>
            {result.transcript && (
              <div className="mt-3 rounded-lg bg-slate-50 p-3 text-right text-sm">
                <b>📝 תמלול:</b> {result.transcript}
              </div>
            )}
            {result.transcribeError && (
              <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 p-3 text-right text-xs text-amber-700">
                <AlertCircle size={14} className="mt-0.5 shrink-0" />
                ההקלטה נשמרה אך לא תומללה (חסר מפתח OpenAI). הליד נוצר מפרטי הטופס.
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <button className="btn-ghost flex-1" onClick={newLead}>
                ליד נוסף
              </button>
              <Link href={`/leads/${result.id}`} className="btn-primary flex-1">
                פתח את הליד
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Voice recorder */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 text-sm font-semibold">הקלטה קולית</div>
              <div className="flex flex-col items-center gap-3">
                {phase !== "recording" ? (
                  <button
                    onClick={startRec}
                    className="grid h-20 w-20 place-items-center rounded-full bg-brand-500 text-white shadow-lg transition-transform active:scale-95"
                    aria-label="התחל הקלטה"
                  >
                    <Mic size={32} />
                  </button>
                ) : (
                  <button
                    onClick={stopRec}
                    className="grid h-20 w-20 animate-pulse place-items-center rounded-full bg-red-500 text-white shadow-lg"
                    aria-label="עצור הקלטה"
                  >
                    <Square size={28} fill="white" />
                  </button>
                )}
                <div className="text-sm text-slate-500">
                  {phase === "recording" ? `מקליט… ${mmss}` : phase === "recorded" ? `הקלטה מוכנה (${mmss})` : "לחצו כדי להקליט"}
                </div>
                {phase === "recorded" && audioUrl && (
                  <div className="flex w-full items-center gap-2">
                    <audio controls src={audioUrl} className="h-9 flex-1" />
                    <button onClick={resetRec} className="text-slate-400 hover:text-red-500" aria-label="מחק הקלטה">
                      <Trash2 size={18} />
                    </button>
                  </div>
                )}
              </div>
              <p className="mt-3 text-center text-[11px] text-slate-400">
                הקליטו את פרטי הליד (שם, טלפון, מה מעניין אותו) — המערכת תתמלל ותחלץ אוטומטית.
              </p>
            </div>

            {/* Form */}
            <div className="rounded-2xl bg-white p-5 shadow-sm">
              <div className="mb-3 text-sm font-semibold">פרטי ליד (לא חובה אם הקלטתם)</div>
              <div className="space-y-2">
                <input className="input" placeholder="שם מלא" value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
                <input className="input" placeholder="טלפון" inputMode="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
                <input className="input" placeholder="חברה" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
                <input className="input" placeholder="במה מעוניין?" value={f.productInterest} onChange={(e) => setF({ ...f, productInterest: e.target.value })} />
                <textarea className="input h-20 resize-none" placeholder="הערות" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
                <AlertCircle size={16} /> {error}
              </div>
            )}

            <button className="btn-primary w-full py-3 text-base" onClick={submit} disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
              צור ליד
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
