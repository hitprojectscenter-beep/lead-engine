// ─────────────────────────────────────────────────────────────
//  Drip runner — sends due nurturing steps and advances each
//  enrollment. Call from a cron (see app/api/cron/nurture) or the
//  "run due now" button. When Twilio is configured, WhatsApp steps
//  are really sent; otherwise the send is simulated + logged so the
//  flow is fully testable in dev.
// ─────────────────────────────────────────────────────────────
import { store } from "../db/store";
import { sendWhatsApp, hasTwilio } from "../ingest/whatsapp";
import { getCampaign, renderTemplate } from "./campaigns";

export interface RunResult {
  processed: number;
  sent: number;
  completed: number;
  skipped: number;
  details: string[];
}

/**
 * Process active enrollments whose next step is due.
 * @param force  ignore the schedule and run every active enrollment (for testing)
 */
export async function runDueNurture(force = false): Promise<RunResult> {
  const now = Date.now();
  const active = await store.listEnrollments({ status: "active" });
  const res: RunResult = { processed: 0, sent: 0, completed: 0, skipped: 0, details: [] };

  for (const e of active) {
    if (!force && new Date(e.nextRunAt).getTime() > now) continue;
    res.processed++;

    const campaign = getCampaign(e.campaignId);
    const lead = await store.getLead(e.leadId);
    if (!campaign || !lead) {
      await store.updateEnrollment(e.id, { status: "stopped", stoppedReason: "קמפיין/ליד חסר" });
      res.skipped++;
      continue;
    }
    // Safety: don't keep nurturing closed leads.
    if (lead.status === "won" || lead.status === "lost") {
      await store.updateEnrollment(e.id, { status: "stopped", stoppedReason: "הליד נסגר" });
      res.skipped++;
      continue;
    }

    const step = campaign.steps[e.stepIndex];
    if (!step) {
      await store.updateEnrollment(e.id, { status: "completed" });
      res.completed++;
      continue;
    }

    const body = renderTemplate(step.template, { name: lead.fullName, product: lead.productInterest });
    let delivered = false;
    if (step.channel === "whatsapp" && hasTwilio && lead.phone) {
      delivered = await sendWhatsApp(lead.phone, body);
    }
    // Email channel + dev mode → simulated (logged); wire a real transport later.

    await store.addActivity({
      leadId: lead.id,
      kind: "nurture_sent",
      actor: "nurture",
      message: `[${campaign.name} · שלב ${e.stepIndex + 1}/${campaign.steps.length} · ${
        step.channel
      }${delivered ? "" : " (הדמיה)"}] ${body}`,
      meta: { campaignId: campaign.id, stepIndex: e.stepIndex, channel: step.channel, delivered },
    });
    res.sent++;
    res.details.push(`${lead.fullName ?? lead.phone}: ${campaign.name} שלב ${e.stepIndex + 1}`);

    // Advance to the next step, or complete.
    const nextIndex = e.stepIndex + 1;
    const nextStep = campaign.steps[nextIndex];
    if (!nextStep) {
      await store.updateEnrollment(e.id, {
        stepIndex: nextIndex,
        status: "completed",
        lastRunAt: new Date().toISOString(),
      });
      res.completed++;
    } else {
      await store.updateEnrollment(e.id, {
        stepIndex: nextIndex,
        lastRunAt: new Date().toISOString(),
        nextRunAt: new Date(Date.now() + nextStep.delayHours * 3600_000).toISOString(),
      });
    }
  }

  return res;
}
