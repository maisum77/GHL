import { NextRequest, NextResponse } from "next/server";
import { isLocalMode } from "@/lib/config";
import { decryptSecret } from "@/lib/crypto";
import { getInstallation, recordAudit } from "@/lib/db";
import { GhlClient } from "@/lib/ghl";
import { allowLeadSubmission, clientKeyFrom } from "@/lib/rate-limit";
import { redactSecrets } from "@/lib/redact";
import { calculateLeadScore, pipelineStageFor } from "@/lib/scoring";
import { leadInputSchema } from "@/lib/validation";
import type { LeadResult, ResourceManifest } from "@/lib/types";

export const runtime = "nodejs";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.slice(1).join(" ");
}

/**
 * GHL can reject an entire contact upsert if one picklist value is not a real option, so
 * an unrecognised value is dropped and reported instead of risking the whole lead.
 */
function allowedFieldValues(
  manifest: ResourceManifest,
  values: Record<string, string>
): { customFields: Array<{ id: string; fieldValue: string }>; warnings: string[] } {
  const customFields: Array<{ id: string; fieldValue: string }> = [];
  const warnings: string[] = [];

  for (const [name, id] of Object.entries(manifest.customFields)) {
    const value = values[name];
    if (!value) {
      continue;
    }
    const options = manifest.customFieldOptions?.[name];
    if (options && options.length > 0 && !options.includes(value.toLocaleLowerCase())) {
      warnings.push(`Skipped ${name}: "${value}" is not one of the configured options.`);
      continue;
    }
    customFields.push({ id, fieldValue: value });
  }

  return { customFields, warnings };
}

export async function POST(request: NextRequest) {
  if (!allowLeadSubmission(clientKeyFrom(request))) {
    return NextResponse.json({ error: "Too many submissions from this connection. Try again shortly." }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = leadInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid lead details" }, { status: 400 });
  }

  const input = parsed.data;
  const result = calculateLeadScore(input);
  const installation = await getInstallation();

  if (!installation) {
    if (!isLocalMode()) {
      return NextResponse.json({ error: "GHL setup is required before accepting leads" }, { status: 503 });
    }
    return NextResponse.json({ ok: true, demo: true, classification: result.status, score: result.score });
  }

  const manifest = installation.manifest;
  let token: string;
  try {
    token = decryptSecret(installation.encryptedToken, installation.locationId);
  } catch {
    return NextResponse.json({ error: "The stored GHL credential could not be read. Re-run setup." }, { status: 502 });
  }

  const client = new GhlClient(token, installation.locationId);
  const fieldValues: Record<string, string> = {
    Company: input.company ?? "",
    Service: input.service,
    Challenge: input.challenge,
    Budget: input.budget,
    Timeline: input.timeline,
    "Existing Website": input.existingWebsite ? "Yes" : "No",
    "Lead Score": String(result.score),
    "Lead Status": result.status,
    "UTM Source": input.utmSource ?? "",
    "UTM Medium": input.utmMedium ?? "",
    "UTM Campaign": input.utmCampaign ?? "",
    "Landing Page": input.landingPage ?? ""
  };
  const { customFields, warnings } = allowedFieldValues(manifest, fieldValues);

  // The contact is the lead. Everything past this point is best-effort: a failure there
  // must not cost us the submission, so it is reported and audited instead of thrown.
  let contactId: string | undefined;
  try {
    const response = await client.upsertContact(installation.locationId, {
      name: input.name,
      firstName: firstName(input.name),
      lastName: lastName(input.name),
      email: input.email,
      phone: input.phone,
      website: input.website,
      companyName: input.company,
      source: "website",
      customFields
    });
    const contact = response.contact && typeof response.contact === "object" ? (response.contact as Record<string, unknown>) : null;
    contactId = contact && typeof contact.id === "string" ? contact.id : undefined;
    if (!contactId) {
      warnings.push("GHL accepted the contact but returned no contact ID, so tagging and pipeline steps were skipped.");
    }
  } catch (error) {
    const message = redactSecrets(error instanceof Error ? error.message : "Lead sync failed", [token]);
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const routing = await routeLead(client, installation.locationId, contactId, result, input.name, input.company, manifest, warnings);

  return NextResponse.json({
    ok: true,
    classification: result.status,
    score: result.score,
    contactId,
    tagged: routing.tagged,
    opportunityCreated: routing.opportunityCreated,
    opportunityStage: routing.opportunityStage,
    enrolledInNurture: routing.enrolled,
    warnings
  });
}

async function routeLead(
  client: GhlClient,
  locationId: string,
  contactId: string | undefined,
  result: LeadResult,
  name: string,
  company: string | undefined,
  manifest: ResourceManifest,
  warnings: string[]
): Promise<{ tagged: boolean; opportunityCreated: boolean; opportunityStage?: string; enrolled: boolean }> {
  if (!contactId) {
    return { tagged: false, opportunityCreated: false, enrolled: false };
  }

  let tagged = false;
  if (manifest.tags[result.status]) {
    try {
      await client.addContactTags(contactId, [result.status]);
      tagged = true;
    } catch (error) {
      warnings.push(`Could not apply the ${result.status} tag: ${describe(error)}`);
    }
  } else {
    warnings.push(`The ${result.status} tag is missing from this location, so the lead was not tagged.`);
  }

  let opportunityCreated = false;
  let opportunityStage: string | undefined;
  if (manifest.pipelineId) {
    const stageName = pipelineStageFor(result.status);
    const stageId = manifest.pipelineStageIds[stageName];
    if (stageId) {
      try {
        await client.createOpportunity({
          locationId,
          contactId,
          pipelineId: manifest.pipelineId,
          pipelineStageId: stageId,
          name: company ? `${name} — ${company}` : name
        });
        opportunityCreated = true;
        opportunityStage = stageName;
      } catch (error) {
        warnings.push(`Contact saved, but the opportunity could not be created: ${describe(error)}`);
      }
    } else {
      warnings.push(`The "${stageName}" pipeline stage was not found, so no opportunity was created.`);
    }
  } else {
    warnings.push("No pipeline is connected, so no opportunity was created.");
  }

  let enrolled = false;
  if (!manifest.nurtureWorkflowId) {
    // Nothing to do. The workflow is either not built yet or not recorded.
  } else if (manifest.nurtureTrigger === "tag") {
    // The workflow fires from a Contact Tag trigger, which GHL handles when the routing
    // tag is applied above. Enrolling as well would enter the workflow a second time and
    // double every notification, so the tag is the only entry point.
  } else {
    try {
      await client.enrollContactInWorkflow(contactId, manifest.nurtureWorkflowId, new Date().toISOString());
      enrolled = true;
    } catch (error) {
      warnings.push(`Contact saved, but nurture enrollment failed: ${describe(error)}`);
    }
  }

  await recordAudit(null, "lead.routed", {
    contactId,
    classification: result.status,
    tagged,
    opportunityCreated,
    enrolled,
    warningCount: warnings.length
  });

  return { tagged, opportunityCreated, opportunityStage, enrolled };
}

function describe(error: unknown): string {
  return error instanceof Error ? redactSecrets(error.message, [], 140) : "unknown GHL error";
}
