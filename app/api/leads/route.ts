import { NextRequest } from "next/server";
import { store } from "@/lib/db/store";
import { ingestLead } from "@/lib/ingest/ingest";
import type { LeadChannel, LeadStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const leads = await store.listLeads({
    status: (sp.get("status") as LeadStatus) || undefined,
    channel: sp.get("channel") || undefined,
    ownerId: sp.get("ownerId") || undefined,
    q: sp.get("q") || undefined,
  });
  return Response.json({ leads });
}

// Manual creation OR raw-text ingestion (channel=manual by default).
export async function POST(req: NextRequest) {
  const bodyJson = await req.json().catch(() => ({}));

  // If a free-text blob is provided, run it through the full pipeline.
  if (bodyJson.rawText || bodyJson.text) {
    const result = await ingestLead({
      channel: (bodyJson.channel as LeadChannel) || "manual",
      text: bodyJson.rawText || bodyJson.text,
      from: bodyJson.phone || null,
      source: bodyJson.source || null,
      prefilled: {
        fullName: bodyJson.fullName ?? null,
        phone: bodyJson.phone ?? null,
        email: bodyJson.email ?? null,
        company: bodyJson.company ?? null,
        productInterest: bodyJson.productInterest ?? null,
      },
      actor: bodyJson.actor || "agent",
    });
    return Response.json(result, { status: 201 });
  }

  // Structured manual creation → still scored + de-duped via the pipeline.
  const result = await ingestLead({
    channel: (bodyJson.channel as LeadChannel) || "manual",
    from: bodyJson.phone || null,
    source: bodyJson.source || null,
    prefilled: {
      fullName: bodyJson.fullName ?? null,
      phone: bodyJson.phone ?? null,
      email: bodyJson.email ?? null,
      company: bodyJson.company ?? null,
      productInterest: bodyJson.productInterest ?? null,
      notes: bodyJson.notes ?? null,
    },
    actor: bodyJson.actor || "agent",
  });
  return Response.json(result, { status: 201 });
}
