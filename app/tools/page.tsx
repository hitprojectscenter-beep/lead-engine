"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageCircle, QrCode, Download, Database, Mic, CheckCircle2, XCircle, Smartphone, ShieldCheck } from "lucide-react";

interface Health {
  hasDb: boolean;
  hasOpenAI: boolean;
  hasTwilio: boolean;
  whitelistActive: boolean;
  baseUrl: string;
}

export default function ToolsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [slug, setSlug] = useState("expo-2026");

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth);
  }, []);

  const base = health?.baseUrl || (typeof window !== "undefined" ? window.location.origin : "");
  const qrUrl = `/api/qr?slug=${encodeURIComponent(slug)}&size=320`;
  const landingUrl = `${base}/l/${slug}?via=qr`;
  const webhookUrl = `${base}/api/webhooks/whatsapp`;
  const intakeQr = `/api/qr?to=${encodeURIComponent("/intake")}&size=320`;
  const intakeUrl = `${base}/intake`;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ערוצי קליטה</h1>
        <p className="text-sm text-slate-500">חיבור מקורות הלידים — QR, דפי נחיתה וווטסאפ</p>
      </div>

      {/* Integration status */}
      <div className="card p-4">
        <h2 className="mb-3 font-bold">סטטוס אינטגרציות</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <StatusRow ok={health?.hasDb} icon={<Database size={16} />} label="מסד נתונים (Postgres)" off="פעיל אחסון JSON מקומי" />
          <StatusRow ok={health?.hasOpenAI} icon={<Mic size={16} />} label="OpenAI (תמלול + חילוץ)" off="חילוץ היוריסטי בלבד" />
          <StatusRow ok={health?.hasTwilio} icon={<MessageCircle size={16} />} label="Twilio WhatsApp" off="ללא מענה אוטומטי" />
          <StatusRow ok={health?.whitelistActive} icon={<ShieldCheck size={16} />} label="Whitelist מספרי ווטסאפ" off="פתוח לכל שולח (הגדירו env)" />
        </div>
      </div>

      {/* PWA intake app */}
      <div className="card p-5">
        <h2 className="mb-1 flex items-center gap-2 font-bold">
          <Smartphone size={18} /> אפליקציית פתיחת ליד (PWA)
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          מסך ייעודי לשטח: טופס מהיר או הקלטה קולית שמתומללת ויוצרת ליד. סרקו כדי לפתוח בטלפון, ואז "הוסף למסך הבית" — יתנהג כמו אפליקציה.
        </p>
        <div className="grid gap-4 sm:grid-cols-[auto,1fr] sm:items-center">
          <div className="grid place-items-center rounded-lg border border-slate-100 bg-slate-50 p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={intakeQr} alt="QR לאפליקציה" className="h-40 w-40" />
          </div>
          <div className="space-y-2 text-sm">
            <Link href="/intake" className="btn-primary w-fit">
              <Smartphone size={16} /> פתח את המסך
            </Link>
            <ol className="list-inside list-decimal space-y-1 text-slate-600">
              <li>סרקו את ה-QR בטלפון (או פתחו {intakeUrl}).</li>
              <li>בתפריט הדפדפן: <b>"הוסף למסך הבית"</b>.</li>
              <li>פותחים מהאייקון → טופס/הקלטה → ליד נוצר מיד.</li>
            </ol>
            <p className="text-[11px] text-slate-400">הקלטה קולית דורשת הרשאת מיקרופון + מפתח OpenAI לתמלול.</p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* QR generator */}
        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-bold">
            <QrCode size={18} /> מחולל QR לדף נחיתה
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            כל מקור (תערוכה, שלט, פלייר) מקבל slug משלו — כך רואים באנליטיקה מאיזה מקור הגיע כל ליד.
          </p>
          <div className="flex gap-2">
            <input className="input" value={slug} onChange={(e) => setSlug(e.target.value.replace(/[^a-z0-9\-_]/gi, ""))} placeholder="שם-מקור" />
            <a href={qrUrl} download={`qr-${slug}.png`} className="btn-primary shrink-0">
              <Download size={16} /> הורדה
            </a>
          </div>
          <div className="mt-4 grid place-items-center rounded-lg border border-slate-100 bg-slate-50 p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt="QR" className="h-48 w-48" />
          </div>
          <div className="mt-2 break-all text-center text-[11px] text-slate-400">{landingUrl}</div>
        </div>

        {/* WhatsApp setup */}
        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-bold">
            <MessageCircle size={18} /> חיבור בוט ווטסאפ (Twilio)
          </h2>
          <p className="mb-3 text-xs text-slate-500">
            כל הודעה או הקלטה שתישלח למספר הבוט תיקלט אוטומטית כליד — כולל תמלול קולי.
          </p>
          <ol className="list-inside list-decimal space-y-2 text-sm text-slate-700">
            <li>ב-Twilio Console → Messaging → WhatsApp Sandbox.</li>
            <li>
              בשדה <b>"When a message comes in"</b> הדביקו:
              <code className="mt-1 block break-all rounded bg-slate-900 px-2 py-1.5 text-[11px] text-green-300">
                {webhookUrl}
              </code>
            </li>
            <li>שיטת בקשה: <b>HTTP POST</b>.</li>
            <li>שלחו <code className="rounded bg-slate-100 px-1">join &lt;code&gt;</code> למספר ה-Sandbox כדי להירשם.</li>
            <li>שלחו הודעת טקסט או הקלטה קולית — הליד יופיע בלוח.</li>
          </ol>
          <p className="mt-3 rounded-lg bg-amber-50 p-2 text-xs text-amber-700">
            ל-production אמיתי נדרש מספר WhatsApp Business מאושר (WABA) במקום ה-Sandbox.
          </p>
          <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
            🔒 אבטחה: הגדירו <code className="rounded bg-slate-200 px-1">WHATSAPP_ALLOWED_SENDERS</code> (מספרים מופרדים בפסיק) כדי לאפשר פתיחת לידים רק ממספרים מורשים.
          </p>
        </div>
      </div>
    </div>
  );
}

function StatusRow({
  ok,
  icon,
  label,
  off,
}: {
  ok?: boolean;
  icon: React.ReactNode;
  label: string;
  off: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
      <span className="text-slate-400">{icon}</span>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        {!ok && <div className="text-[11px] text-slate-400">{off}</div>}
      </div>
      {ok ? (
        <CheckCircle2 className="text-green-500" size={18} />
      ) : (
        <XCircle className="text-slate-300" size={18} />
      )}
    </div>
  );
}
