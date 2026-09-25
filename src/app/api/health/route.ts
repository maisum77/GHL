import { NextResponse } from "next/server";
import { hasDatabase, isLocalMode } from "@/lib/config";
import { getPublicConfig } from "@/lib/setup";

export const runtime = "nodejs";

export async function GET() {
  const config = await getPublicConfig();
  return NextResponse.json({
    ok: true,
    service: "ghl-funnel",
    database: hasDatabase() ? "configured" : isLocalMode() ? "memory-fallback" : "missing",
    ghl: config.connected ? "connected" : "not-configured",
    timestamp: new Date().toISOString()
  });
}
