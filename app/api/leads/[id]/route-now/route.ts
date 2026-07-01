import { NextRequest } from "next/server";
import { store } from "@/lib/db/store";
import { routeLead } from "@/lib/routing/route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Manually trigger auto-routing for a lead (re-assign to the best-fit rep).
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const lead = await store.getLead(id);
  if (!lead) return Response.json({ error: "not found" }, { status: 404 });

  const customer = lead.customerId ? await store.getCustomer(lead.customerId) : null;
  const decision = await routeLead(lead, customer?.ownerId);
  if (!decision.repId) return Response.json({ routed: false, reason: decision.reason });

  const updated = await store.updateLead(id, { ownerId: decision.repId });
  await store.addActivity({
    leadId: id,
    kind: "routed",
    actor: "agent",
    message: `נותב ידנית לנציג ${decision.repName} — ${decision.reason}`,
    meta: { repId: decision.repId },
  });
  return Response.json({ routed: true, lead: updated, decision });
}
