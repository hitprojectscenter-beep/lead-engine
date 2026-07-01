import { NextRequest } from "next/server";
import { store } from "@/lib/db/store";
import { enrollLead, stopEnrollments, pickCampaignId } from "@/lib/nurture/enroll";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manually enroll a lead into a campaign (body.campaignId, or auto-pick).
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lead = await store.getLead(id);
  if (!lead) return Response.json({ error: "not found" }, { status: 404 });

  const b = (await req.json().catch(() => ({}))) as { campaignId?: string };
  const campaignId = b.campaignId || pickCampaignId(lead);
  if (!campaignId)
    return Response.json({ enrolled: false, reason: "אין מסע מתאים לליד זה" }, { status: 400 });

  const enrollment = await enrollLead(id, campaignId, "agent");
  if (!enrollment) return Response.json({ enrolled: false, reason: "נכשל" }, { status: 400 });
  return Response.json({ enrolled: true, enrollment }, { status: 201 });
}

// Stop all active nurturing for a lead.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const n = await stopEnrollments(id, "הופסק ידנית ע\"י נציג");
  return Response.json({ stopped: n });
}
