// ─────────────────────────────────────────────────────────────
//  Public lead-capture endpoint used by landing pages / QR forms.
//  No auth — this is the public "leave your details" form target.
// ─────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import { ingestLead } from "@/lib/ingest/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Record<string, string>;
  const viaQr = b.via === "qr";

  const { lead, created } = await ingestLead({
    channel: viaQr ? "landing_qr" : "landing_web",
    from: b.phone || null,
    text: b.message || null,
    source: b.source || b.slug || "landing",
    prefilled: {
      fullName: b.fullName || null,
      phone: b.phone || null,
      email: b.email || null,
      company: b.company || null,
      productInterest: b.productInterest || b.interest || null,
    },
    actor: "landing",
  });

  return Response.json(
    { ok: true, id: lead.id, created, score: lead.score },
    { status: 201 },
  );
}
