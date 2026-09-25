import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { getRuntimeInstallation } from "@/lib/setup";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ error: "A valid setup session is required" }, { status: 401 });
  }

  try {
    const installation = await getRuntimeInstallation();
    return NextResponse.json({
      connected: true,
      status: installation.status,
      locationId: installation.locationId,
      locationName: installation.locationName,
      formUrl: installation.formUrl,
      bookingUrl: installation.bookingUrl,
      manifest: installation.manifest,
      fieldReports: installation.fieldReports,
      warnings: installation.warnings,
      manualSteps: installation.manualSteps,
      updatedAt: installation.updatedAt
    });
  } catch {
    return NextResponse.json({ connected: false, status: "locked" });
  }
}
