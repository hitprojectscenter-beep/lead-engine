import { NextRequest } from "next/server";
import { store } from "@/lib/db/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const activities = await store.listActivities(id);
  return Response.json({ activities });
}

// Add a manual note or record an outreach action to the timeline.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lead = await store.getLead(id);
  if (!lead) return Response.json({ error: "not found" }, { status: 404 });

  const { message, kind, actor } = (await req.json().catch(() => ({}))) as {
    message?: string;
    kind?: string;
    actor?: string;
  };
  if (!message?.trim()) return Response.json({ error: "message required" }, { status: 400 });

  const activity = await store.addActivity({
    leadId: id,
    kind: (kind as never) || "note",
    actor: actor || "agent",
    message: message.trim(),
  });
  return Response.json({ activity }, { status: 201 });
}
