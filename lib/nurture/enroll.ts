// ─────────────────────────────────────────────────────────────
//  Enrollment logic — add/remove leads to nurturing sequences.
//  Auto-enroll picks a campaign by the lead's readiness so the right
//  drip runs without manual work. Hot/qualified leads are NOT enrolled
//  (a human should handle them); replies pause the sequence.
// ─────────────────────────────────────────────────────────────
import type { Enrollment, Lead } from "../types";
import { store } from "../db/store";
import { getCampaign } from "./campaigns";

function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

/** Which campaign (if any) fits this lead right now. */
export function pickCampaignId(lead: Lead): string | null {
  if (lead.status === "won" || lead.status === "lost") return null;
  if (lead.isExistingCustomer) return "crosssell";
  if (lead.temperature === "hot") return null; // hand to a human, don't drip
  if (lead.temperature === "warm") return "engage";
  return "warmup"; // cold
}

/** Enroll a lead into a campaign (no duplicate active enrollment). */
export async function enrollLead(
  leadId: string,
  campaignId: string,
  actor = "system",
): Promise<Enrollment | null> {
  const campaign = getCampaign(campaignId);
  const lead = await store.getLead(leadId);
  if (!campaign || !lead || !campaign.steps.length) return null;

  const active = await store.listEnrollments({ leadId, status: "active" });
  if (active.some((e) => e.campaignId === campaignId)) return active[0]; // already enrolled

  const enrollment = await store.createEnrollment({
    leadId,
    campaignId,
    stepIndex: 0,
    status: "active",
    enrolledAt: new Date().toISOString(),
    nextRunAt: hoursFromNow(campaign.steps[0].delayHours),
    lastRunAt: null,
    stoppedReason: null,
  });
  await store.addActivity({
    leadId,
    kind: "enrolled",
    actor,
    message: `צורף למסע טיפוח: ${campaign.name} (${campaign.steps.length} מסרים)`,
    meta: { campaignId },
  });
  return enrollment;
}

/** Auto-enroll on ingest, if a campaign fits and none is active yet. */
export async function autoEnroll(lead: Lead): Promise<Enrollment | null> {
  const campaignId = pickCampaignId(lead);
  if (!campaignId) return null;
  const active = await store.listEnrollments({ leadId: lead.id, status: "active" });
  if (active.length) return null; // already being nurtured
  return enrollLead(lead.id, campaignId, "auto");
}

/** Stop all active enrollments for a lead (e.g. reply received, human took over). */
export async function stopEnrollments(leadId: string, reason: string): Promise<number> {
  const active = await store.listEnrollments({ leadId, status: "active" });
  for (const e of active) {
    await store.updateEnrollment(e.id, { status: "stopped", stoppedReason: reason });
  }
  if (active.length) {
    await store.addActivity({
      leadId,
      kind: "nurture_stopped",
      actor: "system",
      message: `מסע הטיפוח הופסק: ${reason}`,
    });
  }
  return active.length;
}
