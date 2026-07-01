import { NextRequest } from "next/server";
import { store } from "@/lib/db/store";
import { scoreLead } from "@/lib/scoring/score";
import { STATUS_LABELS, type Lead, type LeadStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lead = await store.getLead(id);
  if (!lead) return Response.json({ error: "not found" }, { status: 404 });
  const [activities, enrollments] = await Promise.all([
    store.listActivities(id),
    store.listEnrollments({ leadId: id }),
  ]);
  const customer = lead.customerId ? await store.getCustomer(lead.customerId) : null;
  const owner = lead.ownerId ? await store.getRep(lead.ownerId) : null;
  return Response.json({ lead, activities, customer, enrollments, owner });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const existing = await store.getLead(id);
  if (!existing) return Response.json({ error: "not found" }, { status: 404 });

  const patch = (await req.json().catch(() => ({}))) as Partial<Lead> & { actor?: string };
  const actor = patch.actor || "agent";

  // Status change → log to timeline
  if (patch.status && patch.status !== existing.status) {
    await store.addActivity({
      leadId: id,
      kind: "status_change",
      actor,
      message: `סטטוס שונה: ${STATUS_LABELS[existing.status]} → ${
        STATUS_LABELS[patch.status as LeadStatus]
      }`,
    });
  }
  // Assignment → log
  if (patch.ownerId !== undefined && patch.ownerId !== existing.ownerId) {
    await store.addActivity({
      leadId: id,
      kind: "assigned",
      actor,
      message: patch.ownerId ? `שויך לנציג: ${patch.ownerId}` : "בוטל שיוך לנציג",
    });
  }

  // Re-score if a scoring-relevant field changed
  const rescoreKeys = ["productInterest", "isExistingCustomer", "phone", "email", "company"];
  const merged = { ...existing, ...patch };
  if (rescoreKeys.some((k) => k in patch)) {
    const s = scoreLead(merged);
    merged.score = s.score;
    merged.temperature = s.temperature;
    merged.kind = s.kind;
  }

  const updated = await store.updateLead(id, merged);
  return Response.json({ lead: updated });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ok = await store.deleteLead(id);
  return Response.json({ ok });
}
