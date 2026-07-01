import { store } from "@/lib/db/store";
import { LEAD_STATUSES, CHANNEL_LABELS, type LeadChannel } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const leads = await store.listLeads();
  const total = leads.length;

  const byStatus = Object.fromEntries(
    LEAD_STATUSES.map((s) => [s, leads.filter((l) => l.status === s).length]),
  );

  const channelCounts = new Map<string, { count: number; won: number }>();
  for (const l of leads) {
    const c = channelCounts.get(l.channel) ?? { count: 0, won: 0 };
    c.count++;
    if (l.status === "won") c.won++;
    channelCounts.set(l.channel, c);
  }
  const bySource = [...channelCounts.entries()].map(([channel, v]) => ({
    channel,
    label: CHANNEL_LABELS[channel as LeadChannel] ?? channel,
    count: v.count,
    won: v.won,
    conversion: v.count ? Math.round((v.won / v.count) * 100) : 0,
  }));

  const won = leads.filter((l) => l.status === "won").length;
  const lost = leads.filter((l) => l.status === "lost").length;
  const open = total - won - lost;
  const existingCustomers = leads.filter((l) => l.isExistingCustomer).length;
  const hot = leads.filter((l) => l.temperature === "hot").length;
  const avgScore = total ? Math.round(leads.reduce((s, l) => s + l.score, 0) / total) : 0;
  const conversionRate = total ? Math.round((won / total) * 100) : 0;

  return Response.json({
    total,
    open,
    won,
    lost,
    hot,
    existingCustomers,
    avgScore,
    conversionRate,
    byStatus,
    bySource: bySource.sort((a, b) => b.count - a.count),
  });
}
