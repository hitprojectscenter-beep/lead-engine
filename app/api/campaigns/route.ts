import { store } from "@/lib/db/store";
import { CAMPAIGNS, getCampaign } from "@/lib/nurture/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Campaign definitions + all enrollments (joined with lead + campaign names)
// for the nurturing dashboard.
export async function GET() {
  const [enrollments, leads] = await Promise.all([store.listEnrollments(), store.listLeads()]);
  const leadById = new Map(leads.map((l) => [l.id, l]));

  const rows = enrollments
    .map((e) => {
      const lead = leadById.get(e.leadId);
      const campaign = getCampaign(e.campaignId);
      return {
        ...e,
        leadName: lead?.fullName || lead?.phone || "—",
        campaignName: campaign?.name || e.campaignId,
        totalSteps: campaign?.steps.length ?? 0,
      };
    })
    .sort((a, b) => b.enrolledAt.localeCompare(a.enrolledAt));

  const active = rows.filter((r) => r.status === "active").length;

  return Response.json({ campaigns: CAMPAIGNS, enrollments: rows, activeCount: active });
}
