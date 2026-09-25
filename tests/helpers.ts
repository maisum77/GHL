import { vi } from "vitest";
import { encryptSecret } from "@/lib/crypto";
import type { ResourceManifest, SetupRecord } from "@/lib/types";

export const testLocationId = "location-1";
export const testToken = "private-integration-token-value";

/**
 * A GHL double covering the endpoints the provisioning and lead paths touch. Handlers can
 * be overridden per test; anything unhandled returns an empty but well-shaped payload so
 * an added endpoint does not crash unrelated cases.
 */
export function stubGhlFetch(
  overrides: Record<string, (body: unknown, init?: RequestInit) => Response> = {},
  options: { dropOptionsOnLocationRoute?: boolean } = {}
) {
  const state = {
    customFields: [] as Array<Record<string, unknown>>,
    tags: [] as Array<Record<string, unknown>>,
    pipelines: [] as Array<Record<string, unknown>>,
    forms: [] as Array<Record<string, unknown>>,
    workflows: [] as Array<Record<string, unknown>>,
    calendars: [] as Array<Record<string, unknown>>,
    users: [{ id: "user-1", name: "Owner" }],
    calls: [] as Array<{ method: string; url: string; body: unknown }>,
    createdOpportunities: [] as Array<Record<string, unknown>>,
    taggedContacts: [] as Array<{ contactId: string; tags: string[] }>,
    enrolled: [] as Array<{ contactId: string; workflowId: string }>
  };

  const keyFor = (url: string) => {
    if (url.includes("/customFields")) return "customFields";
    if (url.includes("/tags") && !url.includes("/contacts/")) return "tags";
    if (url.includes("/pipelines")) return "pipelines";
    if (url.includes("/forms/")) return "forms";
    if (url.includes("/workflows/")) return "workflows";
    if (url.includes("/calendars/")) return "calendars";
    if (url.includes("/users/")) return "users";
    return "unknown";
  };

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    state.calls.push({ method, url, body });

    const override = overrides[url];
    if (override) {
      return override(body, init);
    }

    if (method === "GET") {
      const isBareLocation = url.endsWith(`/locations/${testLocationId}`);
      if (isBareLocation) {
        return Response.json({ id: testLocationId, name: "Client location" });
      }
      const key = keyFor(url);
      if (key !== "unknown") {
        return Response.json({ [key]: state[key] });
      }
      return Response.json({});
    }

    // Contacts
    if (url.endsWith("/contacts/upsert")) {
      return Response.json({ contact: { id: "contact-1" }, new: true });
    }
    if (/\/contacts\/[^/]+\/tags$/.test(url)) {
      state.taggedContacts.push({
        contactId: url.split("/contacts/")[1].split("/")[0],
        tags: (body as { tags: string[] }).tags
      });
      return Response.json({ tags: (body as { tags: string[] }).tags });
    }
    if (/\/contacts\/[^/]+\/workflow\/[^/]+$/.test(url)) {
      state.enrolled.push({
        contactId: url.split("/contacts/")[1].split("/")[0],
        workflowId: url.split("/workflow/")[1]
      });
      return Response.json({ success: true });
    }
    if (url.endsWith("/opportunities/")) {
      state.createdOpportunities.push(body as Record<string, unknown>);
      return Response.json({ id: "opportunity-1", ...(body as Record<string, unknown>) });
    }
    if (url.endsWith("/opportunities/search")) {
      return Response.json({ opportunities: [], total: 0 });
    }
    if (url.endsWith("/calendars/")) {
      const created = { id: "calendar-created", ...(body as Record<string, unknown>) };
      state.calendars.push(created);
      return Response.json({ calendar: created }, { status: 201 });
    }
    if (url.endsWith("/custom-fields")) {
      const payload = body as Record<string, unknown>;
      const created = {
        id: `field-${payload.name}`,
        name: payload.name,
        dataType: payload.dataType,
        model: "contact",
        picklistOptions: (payload.options as Array<{ key: string; label: string }> | undefined)?.map((o) => o.label) ?? []
      };
      state.customFields.push(created);
      return Response.json({ customField: created }, { status: 201 });
    }
    if (url.includes("/customFields")) {
      const payload = body as Record<string, unknown>;
      const created = {
        id: `field-${payload.name}`,
        name: payload.name,
        dataType: payload.dataType,
        model: "contact",
        // Mirrors GHL: the location route accepts textBoxListOptions for a SINGLE_OPTIONS
        // field, returns 201, and stores nothing.
        picklistOptions: options.dropOptionsOnLocationRoute ? [] : []
      };
      state.customFields.push(created);
      return Response.json({ customField: created }, { status: 201 });
    }
    if (url.includes("/tags")) {
      const created = { id: `tag-${(body as { name: string }).name}`, name: (body as { name: string }).name };
      state.tags.push(created);
      return Response.json({ tag: created }, { status: 201 });
    }
    if (url.includes("/pipelines")) {
      const created = { id: "pipeline-1", name: (body as { name: string }).name, stages: [] };
      state.pipelines.push(created);
      return Response.json({ pipeline: created }, { status: 201 });
    }
    return Response.json({});
  });

  vi.stubGlobal("fetch", fetchMock);
  return { state, fetchMock };
}

export function makeManifest(overrides: Partial<ResourceManifest> = {}): ResourceManifest {
  return {
    customFields: {
      Service: "field-service",
      Budget: "field-budget",
      Timeline: "field-timeline",
      "Lead Score": "field-score",
      "Lead Status": "field-status"
    },
    customFieldOptions: {
      Service: ["website development", "landing page", "crm / funnel", "other"],
      Budget: ["under $500", "$500–$1,500", "$1,500–$3,000", "$3,000–$5,000", "$5,000+"],
      Timeline: ["immediately", "within 30 days", "1–3 months", "just researching"],
      "Lead Status": ["hot", "warm", "nurture"]
    },
    tags: { HOT: "tag-hot", WARM: "tag-warm", NURTURE: "tag-nurture" },
    pipelineId: "pipeline-1",
    pipelineStageIds: { "New Lead": "stage-new", Qualified: "stage-qualified", "Call Booked": "stage-booked" },
    nurtureWorkflowId: "workflow-1",
    forms: [],
    workflows: [],
    calendars: [],
    users: [],
    ...overrides
  };
}

export function makeInstallation(overrides: Partial<SetupRecord> = {}): SetupRecord {
  return {
    id: "installation-1",
    locationId: testLocationId,
    locationName: "Client location",
    // A real ciphertext, so the route under test decrypts it exactly as it would in
    // production rather than failing closed on a placeholder.
    encryptedToken: encryptSecret(testToken, testLocationId),
    tokenFingerprint: "abcdef0123456789",
    formUrl: "https://forms.example/qualification",
    bookingUrl: "https://calendar.example/discovery",
    status: "ready",
    manifest: makeManifest(),
    fieldReports: [],
    warnings: [],
    manualSteps: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides
  };
}

export function leadPayload(overrides: Record<string, unknown> = {}) {
  return {
    name: "Alex Morgan",
    email: "alex@example.com",
    service: "CRM / Funnel",
    challenge: "Need automation",
    budget: "$5,000+",
    timeline: "Immediately",
    existingWebsite: "yes",
    ...overrides
  };
}

/**
 * Clears the in-process setup store. Without a database the app keeps one installation on
 * `globalThis`, which is correct at runtime — a re-run of setup should see the last run —
 * but leaks between test cases.
 */
export function resetMemoryInstallation(): void {
  const state = globalThis as typeof globalThis & { __ghlFunnelMemoryInstallation?: unknown };
  delete state.__ghlFunnelMemoryInstallation;
}
