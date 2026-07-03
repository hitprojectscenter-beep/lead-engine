"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Send, Play, Loader2, Mail, MessageCircle, Clock } from "lucide-react";
import { ENROLLMENT_STATUS_LABELS, type Campaign, type EnrollmentStatus } from "@/lib/types";
import { timeAgo } from "@/lib/utils";

interface EnrollmentRow {
  id: string;
  leadId: string;
  leadName: string;
  campaignName: string;
  stepIndex: number;
  totalSteps: number;
  status: EnrollmentStatus;
  nextRunAt: string;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rows, setRows] = useState<EnrollmentRow[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");

  async function load() {
    const r = await fetch("/api/campaigns").then((x) => x.json());
    setCampaigns(r.campaigns ?? []);
    setRows(r.enrollments ?? []);
    setActiveCount(r.activeCount ?? 0);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function runNow(force: boolean) {
    setRunning(true);
    setRunMsg("");
    const r = await fetch(`/api/cron/nurture${force ? "?force=1" : ""}`, { method: "POST" }).then((x) => x.json());
    setRunMsg(`עובדו ${r.processed}, נשלחו ${r.sent}, הושלמו ${r.completed}.`);
    setRunning(false);
    load();
  }

  const statusChip = (s: EnrollmentStatus) => {
    const c = s === "active" ? "bg-green-100 text-green-700" : s === "completed" ? "bg-slate-100 text-slate-600" : "bg-amber-100 text-amber-700";
    return <span className={`chip ${c}`}>{ENROLLMENT_STATUS_LABELS[s]}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Send size={22} /> מסעות טיפוח אוטומטיים
          </h1>
          <p className="text-sm text-slate-500">
            לידים קרים/פושרים ולקוחות קיימים מצורפים אוטומטית לרצף מסרים. {activeCount} מסעות פעילים כעת.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {runMsg && <span className="text-sm text-slate-500">{runMsg}</span>}
          <button className="btn-ghost" onClick={() => runNow(true)} disabled={running} title="מריץ את כל השלבים הפעילים ללא המתנה לתזמון (לבדיקה)">
            {running ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />} הרץ עכשיו (בדיקה)
          </button>
          <button className="btn-primary" onClick={() => runNow(false)} disabled={running}>
            {running ? <Loader2 className="animate-spin" size={16} /> : <Clock size={16} />} הרץ שלבים שהגיע זמנם
          </button>
        </div>
      </div>

      {/* Campaign definitions */}
      <div className="grid gap-3 md:grid-cols-3">
        {campaigns.map((c) => (
          <div key={c.id} className="card p-4">
            <div className="font-bold">{c.name}</div>
            <div className="mb-2 text-xs text-slate-500">{c.description}</div>
            <ol className="space-y-1.5">
              {c.steps.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5 text-slate-400">
                    {s.channel === "email" ? <Mail size={13} /> : <MessageCircle size={13} />}
                  </span>
                  <span>
                    <span className="text-slate-400">+{s.delayHours} שע׳:</span> {s.template}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>

      {/* Enrollments */}
      <div className="card p-5">
        <h2 className="mb-3 font-bold">הרשמות</h2>
        {loading ? (
          <div className="grid place-items-center py-10 text-slate-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-slate-400">אין הרשמות עדיין.</div>
        ) : (
          <div className="-mx-2 overflow-x-auto px-2">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-right text-slate-500">
                <th className="py-2">ליד</th>
                <th className="py-2">מסע</th>
                <th className="py-2">התקדמות</th>
                <th className="py-2">סטטוס</th>
                <th className="py-2">השלב הבא</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-slate-100">
                  <td className="py-2">
                    <Link href={`/leads/${e.leadId}`} className="font-medium hover:text-brand-600">
                      {e.leadName}
                    </Link>
                  </td>
                  <td className="py-2">{e.campaignName}</td>
                  <td className="py-2">
                    {Math.min(e.stepIndex, e.totalSteps)}/{e.totalSteps}
                  </td>
                  <td className="py-2">{statusChip(e.status)}</td>
                  <td className="py-2 text-slate-500">
                    {e.status === "active" ? timeAgo(e.nextRunAt).replace("לפני", "אמור לרוץ לפני") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
