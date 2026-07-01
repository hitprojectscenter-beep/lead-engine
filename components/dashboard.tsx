"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Flame,
  Star,
  Trophy,
  Users,
  Plus,
  Sparkles,
  Search,
  Loader2,
} from "lucide-react";
import {
  LEAD_STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  CHANNEL_LABELS,
  KIND_LABELS,
  TEMPERATURE_LABELS,
  type Lead,
  type LeadStatus,
} from "@/lib/types";
import { timeAgo } from "@/lib/utils";

interface Stats {
  total: number;
  open: number;
  won: number;
  hot: number;
  existingCustomers: number;
  avgScore: number;
  conversionRate: number;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const [l, s] = await Promise.all([
      fetch("/api/leads").then((r) => r.json()),
      fetch("/api/stats").then((r) => r.json()),
    ]);
    setLeads(l.leads ?? []);
    setStats(s);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return leads;
    const needle = q.toLowerCase();
    return leads.filter((l) =>
      [l.fullName, l.phone, l.email, l.company, l.productInterest, l.rawText]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [leads, q]);

  async function moveLead(id: string, status: LeadStatus) {
    setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status } : l)));
    await fetch(`/api/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">לוח לידים</h1>
          <p className="text-sm text-slate-500">
            קליטה אוטומטית מווטסאפ, QR ודפי נחיתה · ניקוד וניתוב חכם
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute right-2.5 top-2.5 text-slate-400" size={16} />
            <input
              className="input pr-8 w-56"
              placeholder="חיפוש ליד…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={() => setShowNew(true)}>
            <Plus size={16} /> ליד חדש
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <StatCard icon={<Users size={18} />} label="סה״כ לידים" value={stats?.total} tint="#3b6fed" />
        <StatCard icon={<Sparkles size={18} />} label="פתוחים" value={stats?.open} tint="#0ea5e9" />
        <StatCard icon={<Flame size={18} />} label="חמים" value={stats?.hot} tint="#ef4444" />
        <StatCard
          icon={<Star size={18} />}
          label="לקוחות קיימים"
          value={stats?.existingCustomers}
          tint="#f59e0b"
        />
        <StatCard icon={<Trophy size={18} />} label="נסגרו" value={stats?.won} tint="#16a34a" />
        <StatCard
          icon={<span className="text-sm font-bold">%</span>}
          label="אחוז המרה"
          value={stats ? `${stats.conversionRate}%` : undefined}
          tint="#8b5cf6"
        />
      </div>

      {loading ? (
        <div className="grid place-items-center py-20 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="scroll-x flex gap-3 overflow-x-auto pb-4">
          {LEAD_STATUSES.map((status) => {
            const col = filtered.filter((l) => l.status === status);
            return (
              <div key={status} className="w-72 shrink-0">
                <div className="mb-2 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2 font-semibold">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: STATUS_COLORS[status] }}
                    />
                    {STATUS_LABELS[status]}
                  </div>
                  <span className="chip bg-slate-100 text-slate-600">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} onMove={moveLead} />
                  ))}
                  {col.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-xs text-slate-400">
                      אין לידים
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showNew && (
        <NewLeadDialog
          onClose={() => setShowNew(false)}
          onCreated={() => {
            setShowNew(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number | string;
  tint: string;
}) {
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2">
        <span
          className="grid h-8 w-8 place-items-center rounded-lg text-white"
          style={{ background: tint }}
        >
          {icon}
        </span>
        <div>
          <div className="text-lg font-bold leading-none">{value ?? "—"}</div>
          <div className="text-xs text-slate-500">{label}</div>
        </div>
      </div>
    </div>
  );
}

function LeadCard({
  lead,
  onMove,
}: {
  lead: Lead;
  onMove: (id: string, s: LeadStatus) => void;
}) {
  const tempColor =
    lead.temperature === "hot" ? "#ef4444" : lead.temperature === "warm" ? "#f59e0b" : "#94a3b8";
  return (
    <div className="card p-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/leads/${lead.id}`} className="font-semibold hover:text-brand-600">
          {lead.fullName || lead.phone || "ליד ללא שם"}
        </Link>
        <span
          className="chip text-white shrink-0"
          style={{ background: tempColor }}
          title={`ניקוד ${lead.score}`}
        >
          {lead.score}
        </span>
      </div>
      {lead.productInterest && (
        <div className="mt-1 line-clamp-2 text-xs text-slate-600">🎯 {lead.productInterest}</div>
      )}
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="chip bg-slate-100 text-slate-600">{CHANNEL_LABELS[lead.channel]}</span>
        <span className="chip bg-brand-50 text-brand-700">{KIND_LABELS[lead.kind].split(" ")[0]}</span>
        {lead.isExistingCustomer && (
          <span className="chip bg-amber-100 text-amber-700">⭐ לקוח קיים</span>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[11px] text-slate-400">{timeAgo(lead.createdAt)}</span>
        <select
          className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
          value={lead.status}
          onChange={(e) => onMove(lead.id, e.target.value as LeadStatus)}
        >
          {LEAD_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function NewLeadDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [mode, setMode] = useState<"form" | "paste">("form");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    company: "",
    productInterest: "",
  });
  const [paste, setPaste] = useState("");

  async function submit() {
    setBusy(true);
    const body =
      mode === "paste"
        ? { rawText: paste, channel: "manual" }
        : { ...form, channel: "manual" };
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    onCreated();
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div className="card w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-1 text-lg font-bold">ליד חדש</h2>
        <p className="mb-3 text-xs text-slate-500">
          מלאו טופס, או הדביקו טקסט/תמלול חופשי והמערכת תחלץ את הפרטים ותנקד אוטומטית.
        </p>
        <div className="mb-3 flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          <button
            className={`flex-1 rounded-md py-1.5 ${mode === "form" ? "bg-white shadow-sm" : "text-slate-500"}`}
            onClick={() => setMode("form")}
          >
            טופס
          </button>
          <button
            className={`flex-1 rounded-md py-1.5 ${mode === "paste" ? "bg-white shadow-sm" : "text-slate-500"}`}
            onClick={() => setMode("paste")}
          >
            הדבקת טקסט חכמה
          </button>
        </div>

        {mode === "form" ? (
          <div className="space-y-2">
            {(
              [
                ["fullName", "שם מלא"],
                ["phone", "טלפון"],
                ["email", "אימייל"],
                ["company", "חברה"],
                ["productInterest", "מוצר / צורך"],
              ] as const
            ).map(([k, label]) => (
              <input
                key={k}
                className="input"
                placeholder={label}
                value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })}
              />
            ))}
          </div>
        ) : (
          <textarea
            className="input h-36 resize-none"
            placeholder="לדוגמה: היי, מדבר רון מחברת סטארלайт, מעוניין בהצעת מחיר לחבילת פרימיום, דחוף. 050-111-2233"
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
          />
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose}>
            ביטול
          </button>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
            צור ונקד
          </button>
        </div>
      </div>
    </div>
  );
}
