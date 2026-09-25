import { randomUUID } from "node:crypto";
import { assertProductionConfig } from "./config";
import { encryptSecret, fingerprint } from "./crypto";
import { getInstallation, recordAudit, saveInstallation, saveResource } from "./db";
import { GhlApiError, GhlClient, optionLabels } from "./ghl";
import { redactSecrets } from "./redact";
import type {
  FieldReport,
  GhlCalendarConfig,
  GhlCustomField,
  GhlNamedResource,
  GhlPipeline,
  GhlTag,
  PublicSetupConfig,
  ResourceManifest,
  SetupRecord
} from "./types";

/** A problem with what the operator submitted, as opposed to a GHL or network failure. */
export class SetupInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SetupInputError";
  }
}

export interface SetupInput {
  token: string;
  locationId: string;
  formUrl?: string;
  bookingUrl?: string;
  nurtureWorkflowId?: string;
  calendarHostUserId?: string;
}

export interface SetupResult {
  record: SetupRecord;
  created: string[];
  fieldReports: FieldReport[];
  warnings: string[];
  manualSteps: string[];
}

type FieldDefinition = {
  name: string;
  dataType: string;
  options?: string[];
};

const fieldDefinitions: FieldDefinition[] = [
  { name: "Company", dataType: "TEXT" },
  { name: "Website", dataType: "TEXT" },
  { name: "Service", dataType: "SINGLE_OPTIONS", options: ["Website Development", "Landing Page", "SaaS / Web Application", "AI Automation", "CRM / Funnel", "E-commerce", "Other"] },
  { name: "Challenge", dataType: "TEXT" },
  { name: "Budget", dataType: "SINGLE_OPTIONS", options: ["Under $500", "$500–$1,500", "$1,500–$3,000", "$3,000–$5,000", "$5,000+"] },
  { name: "Timeline", dataType: "SINGLE_OPTIONS", options: ["Immediately", "Within 30 days", "1–3 months", "Just researching"] },
  { name: "Existing Website", dataType: "CHECKBOX" },
  { name: "Lead Score", dataType: "NUMERICAL" },
  { name: "Lead Status", dataType: "SINGLE_OPTIONS", options: ["HOT", "WARM", "NURTURE"] },
  { name: "UTM Source", dataType: "TEXT" },
  { name: "UTM Medium", dataType: "TEXT" },
  { name: "UTM Campaign", dataType: "TEXT" },
  { name: "Landing Page", dataType: "TEXT" }
];

const tagNames = ["HOT", "WARM", "NURTURE", "Qualified", "Nurture"];
const pipelineName = "Agency Funnel";
const pipelineStages = ["New Lead", "Qualified", "Call Booked", "Discovery Completed", "Proposal Sent", "Negotiation", "Won", "Lost"];
const discoveryCalendarName = "Discovery Call";
const nurtureWorkflowName = "Lead Nurture";

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function safeMessage(error: unknown, token: string, limit = 180): string {
  const message = error instanceof Error ? error.message : "Unknown GHL error";
  return redactSecrets(message, [token], limit);
}

async function discover<T>(label: string, operation: () => Promise<T>, warnings: string[], token: string, fallback: T): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const status = error instanceof GhlApiError ? ` (${error.status})` : "";
    warnings.push(`Could not read ${label}${status}: ${safeMessage(error, token)}`);
    return fallback;
  }
}

function mapByName<T extends { name: string }>(items: T[]): Map<string, T> {
  return new Map(items.map((item) => [normalized(item.name), item]));
}

function missingOptions(field: GhlCustomField, definition: FieldDefinition): string[] {
  const actual = new Set(optionLabels(field));
  return (definition.options ?? []).filter((option) => !actual.has(normalized(option)));
}

/**
 * Creates one contact custom field and proves the result. A 2xx from GHL is not enough:
 * the location-scoped route returns success while discarding options for SINGLE_OPTIONS
 * fields, so every option-bearing field is read back before it is reported as usable.
 */
async function provisionField(
  client: GhlClient,
  locationId: string,
  definition: FieldDefinition,
  token: string,
  fieldReports: FieldReport[],
  created: string[]
): Promise<void> {
  const hasOptions = (definition.options?.length ?? 0) > 0;
  let field: GhlCustomField | undefined;

  if (hasOptions) {
    try {
      field = await client.createCustomFieldWithOptions(locationId, definition.name, definition.options ?? []);
    } catch (error) {
      const status = error instanceof GhlApiError ? error.status : 0;
      if (status !== 401 && status !== 403 && status !== 404 && status !== 405) {
        fieldReports.push({ name: definition.name, outcome: "failed", detail: safeMessage(error, token) });
        return;
      }
      // The v3 route is not reachable with this token; fall back to the location route.
      try {
        field = await client.createCustomField(locationId, definition.name, definition.dataType, definition.options);
      } catch (fallbackError) {
        fieldReports.push({ name: definition.name, outcome: "failed", detail: safeMessage(fallbackError, token) });
        return;
      }
    }
  } else {
    try {
      field = await client.createCustomField(locationId, definition.name, definition.dataType);
    } catch (error) {
      fieldReports.push({ name: definition.name, outcome: "failed", detail: safeMessage(error, token) });
      return;
    }
  }

  let verified = field;
  if (hasOptions) {
    try {
      const refreshed = await client.getCustomFields(locationId);
      verified = refreshed.find((candidate) => candidate.id === field?.id) ?? field;
    } catch {
      // Keep the creation response if the read-back is unavailable.
    }
  }

  const gaps = hasOptions ? missingOptions(verified, definition) : [];
  if (gaps.length > 0) {
    fieldReports.push({
      name: definition.name,
      outcome: "created_missing_options",
      detail: `Add ${gaps.length} option(s) in GHL: ${gaps.join(", ")}`
    });
    return;
  }

  created.push(`field:${definition.name}`);
  fieldReports.push({ name: definition.name, outcome: "created" });
}

function manifestFromResources(
  customFields: GhlCustomField[],
  tags: GhlTag[],
  pipeline: GhlPipeline | undefined,
  forms: GhlNamedResource[],
  workflows: GhlNamedResource[],
  calendars: GhlNamedResource[],
  users: GhlNamedResource[],
  nurtureWorkflowId: string | undefined
): ResourceManifest {
  return {
    customFields: Object.fromEntries(customFields.map((field) => [field.name, field.id])),
    customFieldOptions: Object.fromEntries(
      fieldDefinitions
        .filter((definition) => (definition.options?.length ?? 0) > 0)
        .map((definition) => {
          const found = customFields.find((field) => normalized(field.name) === normalized(definition.name));
          return [definition.name, found ? optionLabels(found) : []];
        })
    ),
    tags: Object.fromEntries(tags.map((tag) => [tag.name, tag.id])),
    pipelineId: pipeline?.id,
    pipelineStageIds: Object.fromEntries((pipeline?.stages ?? []).map((stage) => [stage.name, stage.id])),
    calendarId: calendars.find((calendar) => normalized(calendar.name) === normalized(discoveryCalendarName))?.id,
    calendarName: discoveryCalendarName,
    nurtureWorkflowId,
    forms,
    workflows,
    calendars,
    users
  };
}


export async function connectAndProvision(input: SetupInput): Promise<SetupResult> {
  assertProductionConfig();
  const token = input.token.trim();
  const locationId = input.locationId.trim();
  if (!token || !locationId) {
    throw new Error("A GHL token and location ID are required");
  }

  const client = new GhlClient(token, locationId);
  const location = await client.getLocation(locationId);
  if (location.id && location.id !== locationId) {
    throw new SetupInputError("The supplied location ID does not match the GHL account returned by the API");
  }
  const existing = await getInstallation();
  if (existing && existing.locationId !== locationId) {
    throw new SetupInputError("This deployment is already connected to a different GHL location");
  }

  const warnings: string[] = [];
  const [customFields, tags, pipelines, forms, workflows, calendars, users] = await Promise.all([
    discover("custom fields", () => client.getCustomFields(locationId), warnings, token, [] as GhlCustomField[]),
    discover("tags", () => client.getTags(locationId), warnings, token, [] as GhlTag[]),
    discover("pipelines", () => client.getPipelines(locationId), warnings, token, [] as GhlPipeline[]),
    discover("forms", () => client.getForms(locationId), warnings, token, [] as GhlNamedResource[]),
    discover("workflows", () => client.getWorkflows(locationId), warnings, token, [] as GhlNamedResource[]),
    discover("calendars", () => client.getCalendars(locationId), warnings, token, [] as GhlNamedResource[]),
    discover("users", () => client.getUsers(locationId), warnings, token, [] as GhlNamedResource[])
  ]);

  const created: string[] = [];
  const fieldReports: FieldReport[] = [];
  const fieldMap = mapByName(customFields);
  for (const definition of fieldDefinitions) {
    const found = fieldMap.get(normalized(definition.name));
    if (found) {
      const gaps = (definition.options?.length ?? 0) > 0 ? missingOptions(found, definition) : [];
      fieldReports.push(
        gaps.length > 0
          ? { name: definition.name, outcome: "existing", detail: `Add ${gaps.length} option(s) in GHL: ${gaps.join(", ")}` }
          : { name: definition.name, outcome: "existing" }
      );
      continue;
    }
    const before = new Set(fieldMap.keys());
    await provisionField(client, locationId, definition, token, fieldReports, created);
    // Re-read so the manifest reflects what GHL actually stored, including IDs from the
    // v3 route, which returns a different envelope than the location route.
    try {
      const refreshed = await client.getCustomFields(locationId);
      for (const candidate of refreshed) {
        const key = normalized(candidate.name);
        if (!before.has(key)) {
          fieldMap.set(key, candidate);
        }
      }
    } catch {
      // Keep whatever the create call returned.
    }
  }

  const tagMap = mapByName(tags);
  for (const tagName of tagNames) {
    if (tagMap.has(normalized(tagName))) {
      continue;
    }
    try {
      const tag = await client.createTag(locationId, tagName);
      tagMap.set(normalized(tagName), tag);
      created.push(`tag:${tagName}`);
    } catch (error) {
      warnings.push(`Could not create tag ${tagName}: ${safeMessage(error, token)}`);
    }
  }

  let pipeline = pipelines.find((candidate) => normalized(candidate.name) === normalized(pipelineName));
  if (!pipeline) {
    try {
      pipeline = await client.createPipeline(locationId, pipelineName, pipelineStages);
      created.push(`pipeline:${pipelineName}`);
    } catch (error) {
      warnings.push(`Could not create pipeline: ${safeMessage(error, token)}`);
    }
  }

  const manualSteps: string[] = [];
  const discoveredCalendars = [...calendars];
  if (!discoveredCalendars.some((calendar) => normalized(calendar.name) === normalized(discoveryCalendarName))) {
    const hostUserId = input.calendarHostUserId?.trim() || users[0]?.id;
    if (!hostUserId) {
      warnings.push("No GHL user was found to own the discovery calendar. Create it manually in GHL.");
      manualSteps.push(`Create a 30-minute "${discoveryCalendarName}" calendar in GHL and assign a host.`);
    } else {
      const config: GhlCalendarConfig = {
        name: discoveryCalendarName,
        calendarType: "personal",
        description: "30-minute discovery call booked from the website funnel.",
        slotDuration: 30,
        slotDurationUnit: "mins",
        slotInterval: 30,
        slotIntervalUnit: "mins",
        appointmentPerSlot: 1,
        appointmentPerDay: 8,
        allowBookingAfter: 0,
        allowBookingAfterUnit: "days",
        allowBookingFor: 30,
        allowBookingForUnit: "days",
        allowReschedule: true,
        allowCancellation: true,
        autoConfirm: true,
        isActive: true,
        teamMembers: [{ userId: hostUserId, priority: 0.5, isPrimary: true }]
      };
      try {
        const calendar = await client.createCalendar(locationId, config);
        discoveredCalendars.push(calendar);
        created.push(`calendar:${discoveryCalendarName}`);
      } catch (error) {
        warnings.push(`Could not create the discovery calendar: ${safeMessage(error, token)}`);
        manualSteps.push(`Create a 30-minute "${discoveryCalendarName}" calendar in GHL and assign a host.`);
      }
    }
  }
  if (discoveredCalendars.some((calendar) => normalized(calendar.name) === normalized(discoveryCalendarName))) {
    manualSteps.push("Connect a Google or Outlook calendar to the host account so the discovery slots show real availability.");
  }

  const requestedNurtureWorkflowId = input.nurtureWorkflowId?.trim() || existing?.manifest.nurtureWorkflowId;
  const nurtureWorkflow =
    (requestedNurtureWorkflowId
      ? workflows.find((workflow) => workflow.id === requestedNurtureWorkflowId)
      : undefined) ??
    workflows.find((workflow) => normalized(workflow.name) === normalized(nurtureWorkflowName));
  const nurtureWorkflowId = nurtureWorkflow?.id ?? requestedNurtureWorkflowId;
  if (!nurtureWorkflowId) {
    manualSteps.push(`Build the "${nurtureWorkflowName}" workflow from NURTURE_WORKFLOW.md, publish it, then paste its ID above.`);
  } else if (!nurtureWorkflow) {
    warnings.push(`Nurture workflow ${nurtureWorkflowId} was not found among the location workflows. Leads will not be auto-enrolled.`);
  }

  const formUrl = input.formUrl?.trim() || existing?.formUrl || "";
  const bookingUrl = input.bookingUrl?.trim() || existing?.bookingUrl || "";
  if (!formUrl) {
    manualSteps.push("Create or import the qualification form in GHL, then paste its public URL above.");
  }
  if (!bookingUrl) {
    manualSteps.push("Open the Discovery Call calendar in GHL and paste its public booking URL above.");
  }
  if (workflows.length === 0) {
    manualSteps.push("No workflows were found in this location. The nurture sequence is the only one required.");
  }
  for (const report of fieldReports) {
    if (report.outcome === "created_missing_options" || (report.outcome === "existing" && report.detail)) {
      manualSteps.push(`${report.name}: ${report.detail ?? "verify its options in GHL"}`);
    }
  }

  const mergedCustomFields = [...fieldMap.values()];
  const mergedTags = [...tagMap.values()];
  const manifest = manifestFromResources(
    mergedCustomFields,
    mergedTags,
    pipeline,
    forms,
    workflows,
    discoveredCalendars,
    users,
    nurtureWorkflowId
  );
  const now = new Date().toISOString();
  const record: SetupRecord = {
    id: existing?.id ?? randomUUID(),
    locationId,
    locationName: typeof location.name === "string" ? location.name : existing?.locationName || "GHL location",
    companyId: typeof location.companyId === "string" ? location.companyId : existing?.companyId,
    encryptedToken: encryptSecret(token, locationId),
    tokenFingerprint: fingerprint(token),
    formUrl,
    bookingUrl,
    status: manualSteps.length === 0 ? "ready" : "awaiting_assets",
    manifest,
    fieldReports,
    warnings,
    manualSteps,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  await saveInstallation(record);
  for (const [name, id] of Object.entries(manifest.customFields)) {
    await saveResource(record.id, "custom_field", name, id);
  }
  for (const [name, id] of Object.entries(manifest.tags)) {
    await saveResource(record.id, "tag", name, id);
  }
  if (manifest.pipelineId) {
    await saveResource(record.id, "pipeline", pipelineName, manifest.pipelineId);
  }
  if (manifest.calendarId) {
    await saveResource(record.id, "calendar", manifest.calendarName ?? discoveryCalendarName, manifest.calendarId);
  }
  if (manifest.nurtureWorkflowId) {
    await saveResource(record.id, "nurture_workflow", nurtureWorkflowName, manifest.nurtureWorkflowId);
  }
  for (const resource of manifest.forms) {
    await saveResource(record.id, "form", resource.name, resource.id);
  }
  for (const resource of manifest.workflows) {
    await saveResource(record.id, "workflow", resource.name, resource.id);
  }
  for (const resource of manifest.calendars) {
    await saveResource(record.id, "calendar", resource.name, resource.id);
  }
  await recordAudit(record.id, "setup.connected", {
    locationId,
    created,
    warningCount: warnings.length,
    fieldOutcomes: fieldReports.map((report) => `${report.name}:${report.outcome}`),
    status: record.status
  });

  return { record, created, fieldReports, warnings, manualSteps };
}

export async function getPublicConfig(): Promise<PublicSetupConfig> {
  try {
    const installation = await getInstallation();
    if (!installation) {
      return {
        connected: false,
        status: "locked",
        formUrl: process.env.GHL_FORM_URL ?? "",
        bookingUrl: process.env.GHL_BOOKING_URL ?? ""
      };
    }

    return {
      connected: true,
      status: installation.status,
      formUrl: installation.formUrl || process.env.GHL_FORM_URL || "",
      bookingUrl: installation.bookingUrl || process.env.GHL_BOOKING_URL || "",
      locationName: installation.locationName
    };
  } catch {
    return {
      connected: false,
      status: "locked",
      formUrl: process.env.GHL_FORM_URL ?? "",
      bookingUrl: process.env.GHL_BOOKING_URL ?? ""
    };
  }
}

export async function getRuntimeInstallation(): Promise<SetupRecord> {
  const installation = await getInstallation();
  if (!installation) {
    throw new Error("GHL setup has not been completed");
  }
  return installation;
}
