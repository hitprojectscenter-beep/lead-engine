import { NextRequest } from "next/server";
import { store } from "@/lib/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = await store.getRep(id);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const rep = await store.upsertRep({
    id,
    name: (b.name as string) ?? existing.name,
    active: b.active === undefined ? existing.active : Boolean(b.active),
    regions: b.regions === undefined ? existing.regions : toList(b.regions),
    specialties: b.specialties === undefined ? existing.specialties : toList(b.specialties),
    capacity: b.capacity === undefined ? existing.capacity : Number(b.capacity) || existing.capacity,
  });
  return Response.json({ rep });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await store.deleteRep(id);
  return Response.json({ ok });
}

function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}
