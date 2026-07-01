"use client";

import { useEffect, useState } from "react";
import { Users, Plus, Loader2, Trash2, MapPin, Tag } from "lucide-react";

interface Rep {
  id: string;
  name: string;
  active: boolean;
  regions: string[];
  specialties: string[];
  capacity: number;
  load: number;
}

export default function RepsPage() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", regions: "", specialties: "", capacity: "25" });
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/reps").then((x) => x.json());
    setReps(r.reps ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!form.name.trim()) return;
    setBusy(true);
    await fetch("/api/reps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setForm({ name: "", regions: "", specialties: "", capacity: "25" });
    setBusy(false);
    load();
  }

  async function toggle(rep: Rep) {
    await fetch(`/api/reps/${rep.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !rep.active }),
    });
    load();
  }

  async function del(id: string) {
    if (!confirm("למחוק את הנציג?")) return;
    await fetch(`/api/reps/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Users size={22} /> נציגים וניתוב
        </h1>
        <p className="text-sm text-slate-500">
          לידים חדשים מנותבים אוטומטית: המשכיות חשבון ללקוח קיים ← התאמת התמחות ← אזור ← איזון עומסים.
        </p>
      </div>

      {/* Add rep */}
      <div className="card p-4">
        <h2 className="mb-3 font-bold">הוספת נציג</h2>
        <div className="grid gap-2 md:grid-cols-5">
          <input className="input" placeholder="שם" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="input" placeholder="אזורים (מופרד בפסיק)" value={form.regions} onChange={(e) => setForm({ ...form, regions: e.target.value })} />
          <input className="input" placeholder="התמחויות (מופרד בפסיק)" value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} />
          <input className="input" type="number" placeholder="קיבולת" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          <button className="btn-primary" onClick={add} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} הוסף
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid place-items-center py-16 text-slate-400">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {reps.map((rep) => {
            const pct = Math.min(100, Math.round((rep.load / Math.max(1, rep.capacity)) * 100));
            const barColor = pct >= 100 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "#16a34a";
            return (
              <div key={rep.id} className={`card p-4 ${rep.active ? "" : "opacity-60"}`}>
                <div className="flex items-start justify-between">
                  <div className="font-bold">{rep.name}</div>
                  <button className="text-slate-300 hover:text-red-500" onClick={() => del(rep.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  {rep.specialties.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Tag size={12} /> {rep.specialties.join(", ")}
                    </div>
                  )}
                  {rep.regions.length > 0 && (
                    <div className="flex items-center gap-1">
                      <MapPin size={12} /> {rep.regions.join(", ")}
                    </div>
                  )}
                </div>
                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>עומס נוכחי</span>
                    <span>
                      {rep.load}/{rep.capacity}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: barColor }} />
                  </div>
                </div>
                <button
                  className={`mt-3 chip ${rep.active ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}
                  onClick={() => toggle(rep)}
                >
                  {rep.active ? "פעיל" : "לא פעיל"} · לחצו לשינוי
                </button>
              </div>
            );
          })}
          {reps.length === 0 && (
            <div className="col-span-full rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-400">
              אין נציגים עדיין — הוסיפו נציג כדי להפעיל ניתוב אוטומטי.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
