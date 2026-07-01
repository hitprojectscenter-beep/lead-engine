// ─────────────────────────────────────────────────────────────
//  Nurture cron — processes due drip steps.
//  Protected by APP_SECRET / CRON_SECRET (Bearer) when set; open in dev.
//  Vercel Cron hits this on a schedule (see vercel.json). ?force=1 runs
//  every active enrollment regardless of schedule (manual "run now").
// ─────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { runDueNurture } from "@/lib/nurture/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.APP_SECRET || process.env.CRON_SECRET;
  if (!secret) return true; // dev — no secret configured
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) return new Response("unauthorized", { status: 401 });
  const force = req.nextUrl.searchParams.get("force") === "1";
  const result = await runDueNurture(force);
  return Response.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
