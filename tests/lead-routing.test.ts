import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/leads/route";
import { NextRequest } from "next/server";
import { makeInstallation, makeManifest, stubGhlFetch, testToken } from "./helpers";

const installation = makeInstallation();

vi.mock("@/lib/db", () => ({
  getInstallation: vi.fn(async () => installation),
  recordAudit: vi.fn(async () => undefined)
}));

beforeEach(() => {
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "a".repeat(64));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

let requestCounter = 0;

function post(body: Record<string, unknown>) {
  requestCounter += 1;
  return POST(
    new NextRequest("https://funnel.test/api/leads", {
      method: "POST",
      // The lead limiter is process-wide and keyed by client, so each case needs its own.
      headers: { "content-type": "application/json", "x-forwarded-for": `203.0.113.${requestCounter}` },
      body: JSON.stringify(body)
    })
  );
}

const hotLead = {
  name: "Alex Morgan",
  email: "alex@example.com",
  service: "CRM / Funnel",
  challenge: "Need automation",
  budget: "$5,000+",
  timeline: "Immediately",
  existingWebsite: "yes"
};

describe("lead routing", () => {
  it("tags, creates an opportunity at the HOT stage, and enrolls in nurture", async () => {
    const { state } = stubGhlFetch();

    const response = await post(hotLead);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.classification).toBe("HOT");
    expect(body.tagged).toBe(true);
    expect(body.opportunityCreated).toBe(true);
    expect(body.opportunityStage).toBe("Qualified");
    expect(body.enrolledInNurture).toBe(true);

    expect(state.taggedContacts).toEqual([{ contactId: "contact-1", tags: ["HOT"] }]);
    expect(state.enrolled).toEqual([{ contactId: "contact-1", workflowId: "workflow-1" }]);
    expect(state.createdOpportunities).toHaveLength(1);
    expect(state.createdOpportunities[0]).toMatchObject({
      locationId: "location-1",
      contactId: "contact-1",
      pipelineId: "pipeline-1",
      pipelineStageId: "stage-qualified",
      name: "Alex Morgan",
      status: "open"
    });
  });

  it("opens WARM and NURTURE leads at the top of the funnel", async () => {
    const { state } = stubGhlFetch();

    const response = await post({ ...hotLead, budget: "$500–$1,500", timeline: "Just researching", existingWebsite: "no" });
    const body = await response.json();

    expect(body.classification).toBe("NURTURE");
    expect(body.opportunityStage).toBe("New Lead");
    expect(state.createdOpportunities[0]).toMatchObject({ pipelineStageId: "stage-new" });
  });

  it("names the opportunity with the company when one is given", async () => {
    const { state } = stubGhlFetch();

    await post({ ...hotLead, company: "Acme Ltd" });

    expect(state.createdOpportunities[0]).toMatchObject({ name: "Alex Morgan — Acme Ltd" });
  });

  it("keeps the lead when tagging fails", async () => {
    stubGhlFetch({
      [`https://services.leadconnectorhq.com/contacts/contact-1/tags`]: () =>
        Response.json({ message: "nope" }, { status: 500 })
    });

    const response = await post(hotLead);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contactId).toBe("contact-1");
    expect(body.tagged).toBe(false);
    expect(body.opportunityCreated).toBe(true);
    expect(body.warnings.join(" ")).toContain("HOT tag");
  });

  it("keeps the lead when opportunity creation fails", async () => {
    stubGhlFetch({
      "https://services.leadconnectorhq.com/opportunities/": () =>
        Response.json({ message: "pipeline locked" }, { status: 500 })
    });

    const response = await post(hotLead);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.contactId).toBe("contact-1");
    expect(body.opportunityCreated).toBe(false);
    expect(body.warnings.join(" ")).toContain("opportunity could not be created");
  });

  it("keeps the lead when nurture enrollment fails", async () => {
    stubGhlFetch({
      "https://services.leadconnectorhq.com/contacts/contact-1/workflow/workflow-1": () =>
        Response.json({ message: "workflow not published" }, { status: 400 })
    });

    const response = await post(hotLead);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.enrolledInNurture).toBe(false);
    expect(body.warnings.join(" ")).toContain("nurture enrollment failed");
  });

  it("warns instead of throwing when no pipeline is connected", async () => {
    const noPipeline = makeInstallation({ manifest: makeManifest({ pipelineId: undefined }) });
    vi.mocked((await import("@/lib/db")).getInstallation).mockResolvedValue(noPipeline);
    const { state } = stubGhlFetch();

    const response = await post(hotLead);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.opportunityCreated).toBe(false);
    expect(state.createdOpportunities).toHaveLength(0);
    expect(body.warnings.join(" ")).toContain("No pipeline");
  });

  it("warns instead of throwing when the target stage is missing", async () => {
    const badStage = makeInstallation({ manifest: makeManifest({ pipelineStageIds: {} }) });
    vi.mocked((await import("@/lib/db")).getInstallation).mockResolvedValue(badStage);
    stubGhlFetch();

    const body = await (await post(hotLead)).json();

    expect(body.opportunityCreated).toBe(false);
    expect(body.warnings.join(" ")).toContain("pipeline stage was not found");
  });

  it("returns 502 and never echoes the GHL token", async () => {
    stubGhlFetch({
      "https://services.leadconnectorhq.com/contacts/upsert": () =>
        Response.json({ message: `invalid token ${testToken}` }, { status: 401 })
    });

    const response = await post(hotLead);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(JSON.stringify(body)).not.toContain(testToken);
    expect(body.error).toContain("[redacted]");
  });
});

describe("custom field values on the lead", () => {
  it("drops a value the location does not actually have as an option", async () => {
    // A pre-existing client field can hold different options than ours. GHL may reject the
    // whole upsert over one bad picklist value, so it is filtered out and reported.
    const mismatched = makeInstallation({
      manifest: makeManifest({ customFieldOptions: { Budget: ["under $500", "$500–$1,500"] } })
    });
    vi.mocked((await import("@/lib/db")).getInstallation).mockResolvedValue(mismatched);
    const { state } = stubGhlFetch();

    const body = await (await post(hotLead)).json();

    const upsert = state.calls.find((call) => call.url.endsWith("/contacts/upsert"));
    const fields = (upsert?.body as { customFields: Array<{ id: string; fieldValue: string }> }).customFields;

    expect(fields.find((field) => field.id === "field-budget")).toBeUndefined();
    expect(fields.find((field) => field.id === "field-status")).toEqual({ id: "field-status", fieldValue: "HOT" });
    expect(body.warnings.join(" ")).toContain("Budget");
  });

  it("passes values through when the option list is unknown", async () => {
    // An empty option list means the options were never saved, not that no value is valid.
    const unknownOptions = makeInstallation({
      manifest: makeManifest({ customFieldOptions: { Budget: [] } })
    });
    vi.mocked((await import("@/lib/db")).getInstallation).mockResolvedValue(unknownOptions);
    const { state } = stubGhlFetch();

    await post(hotLead);

    const upsert = state.calls.find((call) => call.url.endsWith("/contacts/upsert"));
    const fields = (upsert?.body as { customFields: Array<{ id: string; fieldValue: string }> }).customFields;

    expect(fields).toContainEqual({ id: "field-budget", fieldValue: "$5,000+" });
  });

  it("passes through values that match a real option", async () => {
    const { state } = stubGhlFetch();

    await post(hotLead);

    const upsert = state.calls.find((call) => call.url.endsWith("/contacts/upsert"));
    const fields = (upsert?.body as { customFields: Array<{ id: string; fieldValue: string }> }).customFields;

    expect(fields).toContainEqual({ id: "field-budget", fieldValue: "$5,000+" });
    expect(fields).toContainEqual({ id: "field-timeline", fieldValue: "Immediately" });
    expect(fields).toContainEqual({ id: "field-score", fieldValue: "70" });
  });
});
