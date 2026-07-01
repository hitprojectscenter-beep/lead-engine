"use client";

import { use, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Radio } from "lucide-react";

export default function Landing({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const sp = useSearchParams();
  const via = sp.get("via") || "web";
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ fullName: "", phone: "", email: "", company: "", productInterest: "", message: "" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    await fetch("/api/capture", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, slug, source: slug, via }),
    });
    setBusy(false);
    setDone(true);
  }

  return (
    <div className="fixed inset-0 grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 p-4" dir="rtl">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-500 text-white">
            <Radio size={18} />
          </span>
          <div>
            <div className="font-bold">השאירו פרטים</div>
            <div className="text-xs text-slate-500">נחזור אליכם בהקדם</div>
          </div>
        </div>

        {done ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto mb-3 text-green-500" size={48} />
            <h2 className="text-lg font-bold">תודה! הפרטים התקבלו.</h2>
            <p className="text-sm text-slate-500">נציג יחזור אליכם בהקדם.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-2.5">
            <input className="input" placeholder="שם מלא *" required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} />
            <input className="input" placeholder="טלפון *" required value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
            <input className="input" placeholder="אימייל" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className="input" placeholder="חברה" value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} />
            <input className="input" placeholder="במה אתם מעוניינים?" value={f.productInterest} onChange={(e) => setF({ ...f, productInterest: e.target.value })} />
            <textarea className="input h-20 resize-none" placeholder="הודעה חופשית (לא חובה)" value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} />
            <button className="btn-primary w-full" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" size={16} /> : "שליחה"}
            </button>
            <p className="text-center text-[11px] text-slate-400">מקור: {slug} · {via === "qr" ? "סריקת QR" : "אתר"}</p>
          </form>
        )}
      </div>
    </div>
  );
}
