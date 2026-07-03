"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { LEAD_STATUSES, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";

interface Stats {
  total: number;
  open: number;
  won: number;
  lost: number;
  conversionRate: number;
  avgScore: number;
  byStatus: Record<string, number>;
  bySource: { channel: string; label: string; count: number; won: number; conversion: number }[];
}

export default function AnalyticsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  useEffect(() => {
    fetch("/api/stats").then((r) => r.json()).then(setStats);
  }, []);

  if (!stats) return <div className="py-20 text-center text-slate-400">טוען…</div>;

  const statusData = LEAD_STATUSES.map((s) => ({
    name: STATUS_LABELS[s],
    value: stats.byStatus[s] ?? 0,
    color: STATUS_COLORS[s],
  })).filter((d) => d.value > 0);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">אנליטיקה</h1>
        <p className="text-sm text-slate-500">מדידת ביצועים ואופטימיזציה של מקורות</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="אחוז המרה" value={`${stats.conversionRate}%`} />
        <KpiCard label="ניקוד ממוצע" value={stats.avgScore} />
        <KpiCard label="נסגרו בהצלחה" value={stats.won} />
        <KpiCard label="אבודים" value={stats.lost} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 font-bold">לידים לפי שלב</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                {statusData.map((d, i) => (
                  <Cell key={i} fill={d.color} />
                ))}
              </Pie>
              <Legend />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 font-bold">מקורות: כמות והמרה</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={stats.bySource} layout="vertical" margin={{ right: 20 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="label" width={110} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(v: number, n: string) => [v, n === "count" ? "לידים" : "נסגרו"]}
              />
              <Bar dataKey="count" fill="#3b6fed" radius={[0, 6, 6, 0]} name="count" />
              <Bar dataKey="won" fill="#16a34a" radius={[0, 6, 6, 0]} name="won" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-bold">ROI לפי מקור</h2>
        <div className="-mx-2 overflow-x-auto px-2">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-right text-slate-500">
              <th className="py-2">מקור</th>
              <th className="py-2">לידים</th>
              <th className="py-2">נסגרו</th>
              <th className="py-2">המרה</th>
            </tr>
          </thead>
          <tbody>
            {stats.bySource.map((s) => (
              <tr key={s.channel} className="border-b border-slate-100">
                <td className="py-2 font-medium">{s.label}</td>
                <td className="py-2">{s.count}</td>
                <td className="py-2">{s.won}</td>
                <td className="py-2">
                  <span className="chip bg-brand-50 text-brand-700">{s.conversion}%</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="card p-4">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
