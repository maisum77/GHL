import { NextRequest, NextResponse } from "next/server";
import { createSessionValue, sessionCookieOptions, setupAccessCodeIsValid, setupSessionCookie } from "@/lib/auth";
import { GhlApiError } from "@/lib/ghl";
import { allowSetupAttempt, clientKeyFrom } from "@/lib/rate-limit";
import { redactSecrets } from "@/lib/redact";
import { connectAndProvision, SetupInputError } from "@/lib/setup";
import { setupInputSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = setupInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid setup details" }, { status: 400 });
  }

  if (!allowSetupAttempt(clientKeyFrom(request))) {
    return NextResponse.json({ error: "Too many setup attempts. Try again later." }, { status: 429 });
  }

  if (!setupAccessCodeIsValid(parsed.data.accessCode)) {
    return NextResponse.json({ error: "The setup access code is not valid" }, { status: 401 });
  }

  try {
    const result = await connectAndProvision(parsed.data);
    const response = NextResponse.json({
      ok: true,
      status: result.record.status,
      locationId: result.record.locationId,
      locationName: result.record.locationName,
      created: result.created,
      fieldReports: result.fieldReports,
      warnings: result.warnings,
      manualSteps: result.manualSteps,
      formUrl: result.record.formUrl,
      bookingUrl: result.record.bookingUrl,
      nurtureWorkflowId: result.record.manifest.nurtureWorkflowId,
      nurtureTrigger: result.record.manifest.nurtureTrigger,
      calendarHostConnected: result.record.manifest.calendarHostConnected ?? false,
      calendarId: result.record.manifest.calendarId
    });
    response.cookies.set(setupSessionCookie, createSessionValue(), sessionCookieOptions);
    return response;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "GHL setup failed";
    const message = redactSecrets(rawMessage, [parsed.data.token], 240);
    const status =
      error instanceof SetupInputError
        ? 400
        : error instanceof GhlApiError && error.status >= 400 && error.status < 500
          ? 400
          : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
