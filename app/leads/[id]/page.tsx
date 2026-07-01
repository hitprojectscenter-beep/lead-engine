"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Phone,
  Mail,
  Building2,
  Star,
  Send,
  Loader2,
  Trash2,
} from "lucide-react";
import {
  LEAD_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  CHANNEL_LABELS,
  KIND_LABELS,
  ACTIVITY_LABELS,
  type Activity,
  type Customer,
  type Lead,
  type LeadStatus,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

export default function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const r = await fetch(`/api/leads/${id}`).then((x) => x.json());
    setLead(r.lead);
    setActivities(r.activities ?? []);
    setCustomer(r.customer ?? null);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, [id]);

  async function patch(body: Partial<Lead>) {
    setLead((l) => (l ? { ...l, ...body } : l));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    await fetch(`/api/leads/${id}/activities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: note, kind: "note" }),
    });
    setNote("");
    setBusy(false);
    load();
  }

  async function del() {
    if (!confirm("למחוק את הליד?")) return;
    await fetch(`/api/leads/${id}`, { method: "DELETE" });
    window.location.href = "/";
  }

  if (loading)
    return (
      <div className="grid place-items-center py-20 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    );
  if (!lead) return <div className="py-20 text-center text-slate-500">הליד לא נמצא.</div>;

  const scoredReasons =
    (activities.find((a) => a.kind === "scored")?.meta?.reasons as string[] | undefined) ?? [];

  return (
    <div className="space-y-4">
      <Link href="/" className="btn-ghost w-fit">
        <ArrowRight size={16} /> חזרה ללוח
      </Link>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Main */}
        <div className="space-y-4 lg:col-span-2">
          <div className="card p-5">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{lead.fullName || lead.phone || "ליד"}</h1>
                <div className="mt-1 flex flex-wrap gap-1.5 text-sm">
                  <span className="chip bg-slate-100 text-slate-600">
                    {CHANNEL_LABELS[lead.channel]}
                  </span>
                  <span className="chip bg-brand-50 text-brand-700">{KIND_LABELS[lead.kind]}</span>
                  {lead.isExistingCustomer && (
                    <span className="chip bg-amber-100 text-amber-700">⭐ לקוח קיים</span>
                  )}
                </div>
              </div>
              <ScoreBadge score={lead.score} temp={lead.temperature} />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <Field icon={<Phone size={15} />} label="טלפון" value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
              <Field icon={<Mail size={15} />} label="אימייל" value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
              <Field icon={<Building2 size={15} />} label="חברה" value={lead.company} />
              <Field icon={<Star size={15} />} label="מקור" value={lead.source} />
            </div>

            {lead.productInterest && (
              <div className="mt-3 rounded-lg bg-brand-50 p-3 text-sm">
                <b>מוצר / צורך:</b> {lead.productInterest}
              </div>
            )}
            {lead.transcript && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                <b>📝 תמלול הקלטה:</b> {lead.transcript}
              </div>
            )}
            {lead.rawText && !lead.transcript && (
              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                <b>הודעה מקורית:</b> {lead.rawText}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2">
              <button className="btn-ghost text-red-600 hover:bg-red-50" onClick={del}>
                <Trash2 size={15} /> מחיקה
              </button>
            </div>
          </div>

          {/* Timeline */}
          <div className="card p-5">
            <h2 className="mb-3 font-bold">ציר זמן</h2>
            <div className="mb-3 flex gap-2">
              <input
                className="input"
                placeholder="הוסף הערה / תיעוד שיחה…"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addNote()}
              />
              <button className="btn-primary" onClick={addNote} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
              </button>
            </div>
            <ol className="space-y-3">
              {activities.map((a) => (
                <li key={a.id} className="flex gap-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" />
                  <div>
                    <div className="text-sm">
                      <b>{ACTIVITY_LABELS[a.kind] ?? a.kind}</b> — {a.message}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {formatDateTime(a.createdAt)} · {a.actor}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="mb-2 font-bold">ניהול</h3>
            <label className="text-xs text-slate-500">סטטוס</label>
            <select
              className="input mt-1"
              value={lead.status}
              onChange={(e) => patch({ status: e.target.value as LeadStatus })}
            >
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <label className="mt-3 block text-xs text-slate-500">נציג מטפל</label>
            <input
              className="input mt-1"
              placeholder="מזהה נציג"
              defaultValue={lead.ownerId ?? ""}
              onBlur={(e) => e.target.value !== (lead.ownerId ?? "") && patch({ ownerId: e.target.value || null })}
            />
          </div>

          {scoredReasons.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-2 font-bold">למה הניקוד הזה?</h3>
              <ul className="space-y-1 text-sm text-slate-600">
                {scoredReasons.map((r, i) => (
                  <li key={i}>• {r}</li>
                ))}
              </ul>
            </div>
          )}

          {customer && (
            <div className="card border-amber-200 bg-amber-50 p-4">
              <h3 className="mb-1 flex items-center gap-1 font-bold text-amber-800">
                <Star size={16} /> לקוח קיים
              </h3>
              <p className="text-sm text-amber-900">{customer.name}</p>
              {customer.company && <p className="text-xs text-amber-700">{customer.company}</p>}
              {customer.products.length > 0 && (
                <p className="mt-2 text-xs text-amber-800">
                  <b>מחזיק:</b> {customer.products.join(", ")}
                </p>
              )}
              <p className="mt-2 text-xs text-amber-700">
                הזדמנות Cross-sell / Upsell — תעדוף גבוה.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | null;
  href?: string;
}) {
  const content = (
    <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-500">{label}:</span>
      <span className="font-medium">{value || "—"}</span>
    </div>
  );
  return href && value ? (
    <a href={href} className="hover:opacity-80">
      {content}
    </a>
  ) : (
    content
  );
}

function ScoreBadge({ score, temp }: { score: number; temp: string }) {
  const color = temp === "hot" ? "#ef4444" : temp === "warm" ? "#f59e0b" : "#94a3b8";
  return (
    <div className="grid h-16 w-16 place-items-center rounded-full text-white" style={{ background: color }}>
      <div className="text-center leading-none">
        <div className="text-xl font-bold">{score}</div>
        <div className="text-[9px]">/100</div>
      </div>
    </div>
  );
}
