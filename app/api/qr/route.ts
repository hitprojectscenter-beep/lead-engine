// ─────────────────────────────────────────────────────────────
//  QR code generator. GET /api/qr?slug=expo-2026  →  PNG that opens
//  the landing form  /l/<slug>  so a scan starts lead capture.
// ─────────────────────────────────────────────────────────────
import { NextRequest } from "next/server";
import QRCode from "qrcode";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const base =
    process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin || "http://localhost:3000";

  // `to` = an explicit in-app path (e.g. /intake); otherwise a landing slug.
  const to = sp.get("to");
  const slug = (sp.get("slug") || "general").replace(/[^a-z0-9\-_]/gi, "");
  const target = to
    ? `${base}${to.startsWith("/") ? "" : "/"}${to.replace(/[^a-z0-9\-_/?=&]/gi, "")}`
    : `${base}/l/${slug}?via=qr`;

  const png = await QRCode.toBuffer(target, {
    width: Number(sp.get("size")) || 512,
    margin: 2,
    color: { dark: "#1e293b", light: "#ffffff" },
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
