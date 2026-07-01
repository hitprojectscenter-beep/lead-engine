import { NextRequest } from "next/server";
import { hasDb } from "@/lib/db/client";
import { hasOpenAI } from "@/lib/ingest/transcribe";
import { hasTwilio, whitelistActive } from "@/lib/ingest/whatsapp";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  // Prefer the configured public URL; otherwise derive from the request so
  // links shown in the UI match whatever host/port the app is served on.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || req.nextUrl.origin;
  return Response.json({ hasDb, hasOpenAI, hasTwilio, whitelistActive, baseUrl });
}
