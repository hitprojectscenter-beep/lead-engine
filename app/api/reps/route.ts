import { NextRequest } from "next/server";
import { store } from "@/lib/db/store";
import { loadByRep } from "@/lib/routing/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [reps, load] = await Promise.all([store.listReps(), loadByRep()]);
  return Response.json({
    reps: reps.map((r) => ({ ...r, load: load.get(r.id) ?? 0 })),
  });
}

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  if (!b.name) return Response.json({ error: "name required" }, { status: 400 });
  const rep = await store.upsertRep({
    id: (b.id as string) || undefined,
    name: String(b.name),
    active: b.active === undefined ? true : Boolean(b.active),
    regions: toList(b.regions),
    specialties: toList(b.specialties),
    capacity: Number(b.capacity) || 25,
  });
  return Response.json({ rep }, { status: 201 });
}

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
