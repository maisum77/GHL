import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectAndProvision } from "@/lib/setup";
import { resetMemoryInstallation, stubGhlFetch, testLocationId, testToken } from "./helpers";

beforeEach(() => {
  resetMemoryInstallation();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("connectAndProvision", () => {
  it("discovers resources and provisions the safe manifest", async () => {
    const { state } = stubGhlFetch();

    const result = await connectAndProvision({
      token: testToken,
      locationId: testLocationId,
      formUrl: "https://forms.example/qualification",
      bookingUrl: "https://calendar.example/discovery"
    });

    expect(result.created).toContain("pipeline:Agency Funnel");
    expect(result.created).toContain("tag:HOT");
    expect(result.record.manifest.pipelineId).toBe("pipeline-1");
    expect(result.record.manifest.customFields["Lead Status"]).toBe("field-Lead Status");

    // Every expected field is attempted, whether or not it already exists.
    const fieldNames = result.record.fieldReports.map((report) => report.name);
    expect(fieldNames).toHaveLength(12);
    // `Website` is deliberately absent: GHL rejects a custom field that shadows the
    // standard contact website field, and the lead route writes to that directly.
    expect(fieldNames).not.toContain("Website");
    expect(state.customFields.length + 0).toBeGreaterThan(0);
  });

  it("keys the tag manifest by canonical name even though GHL lowercases tags", async () => {
    const { state } = stubGhlFetch();
    // GHL stores every tag lowercased, whatever case it was created with.
    state.tags = [{ id: "tag-hot", name: "hot" }];

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    // The lead route looks up manifest.tags["HOT"]; a raw-name key would silently
    // leave every lead untagged.
    expect(result.record.manifest.tags.HOT).toBe("tag-hot");
    expect(result.record.manifest.tags["Qualified"]).toBeDefined();
  });

  it("provisions the discovery calendar with 30-minute slots", async () => {
    const { state } = stubGhlFetch();

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    expect(result.created).toContain("calendar:Discovery Call");
    expect(result.record.manifest.calendarId).toBe("calendar-created");

    const created = state.calendars.find((calendar) => calendar.name === "Discovery Call");
    expect(created).toMatchObject({
      locationId: testLocationId,
      slotDuration: 30,
      slotDurationUnit: "mins",
      appointmentPerDay: 8,
      allowBookingFor: 30,
      allowReschedule: true,
      allowCancellation: true
    });
    expect(state.calls.some((call) => call.method === "POST" && call.url.endsWith("/calendars/"))).toBe(true);
  });

  it("does not create a second calendar on re-run", async () => {
    const { state } = stubGhlFetch();
    state.calendars = [{ id: "calendar-existing", name: "Discovery Call" }];

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    expect(result.created).not.toContain("calendar:Discovery Call");
    expect(result.record.manifest.calendarId).toBe("calendar-existing");
    expect(state.calls.some((call) => call.method === "POST" && call.url.endsWith("/calendars/"))).toBe(false);
  });

  it("adopts a nurture workflow by name when no ID is supplied", async () => {
    const { state } = stubGhlFetch();
    state.workflows = [{ id: "workflow-9", name: "Lead Nurture" }];

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    expect(result.record.manifest.nurtureWorkflowId).toBe("workflow-9");
    expect(result.manualSteps.join(" ")).not.toContain("NURTURE_WORKFLOW.md");
  });

  it("honours an explicit nurture workflow ID", async () => {
    const { state } = stubGhlFetch();
    state.workflows = [{ id: "workflow-7", name: "Some Other Name" }];

    const result = await connectAndProvision({
      token: testToken,
      locationId: testLocationId,
      nurtureWorkflowId: "workflow-7"
    });

    expect(result.record.manifest.nurtureWorkflowId).toBe("workflow-7");
  });

  it("warns about a nurture workflow ID that does not exist in the location", async () => {
    stubGhlFetch();

    const result = await connectAndProvision({
      token: testToken,
      locationId: testLocationId,
      nurtureWorkflowId: "workflow-missing"
    });

    expect(result.warnings.join(" ")).toContain("was not found among the location workflows");
  });

  it("is idempotent across repeated runs", async () => {
    const first = stubGhlFetch();
    await connectAndProvision({ token: testToken, locationId: testLocationId });
    const persisted = {
      customFields: first.state.customFields,
      tags: first.state.tags,
      pipelines: first.state.pipelines,
      calendars: first.state.calendars
    };

    const second = stubGhlFetch();
    second.state.customFields = persisted.customFields;
    second.state.tags = persisted.tags;
    second.state.pipelines = persisted.pipelines;
    second.state.calendars = persisted.calendars;

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    expect(result.created).not.toContain("tag:HOT");
    expect(result.created).not.toContain("pipeline:Agency Funnel");
    expect(result.created).not.toContain("calendar:Discovery Call");
    expect(result.created.filter((item) => item.startsWith("field:"))).toHaveLength(0);
  });

  it("stays awaiting_assets and lists the remaining manual work", async () => {
    stubGhlFetch();

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    expect(result.record.status).toBe("awaiting_assets");
    const steps = result.manualSteps.join(" | ");
    expect(steps).toContain("NURTURE_WORKFLOW.md");
    expect(steps).toContain("Connect a Google or Outlook calendar");
    expect(steps).toContain("booking URL");
  });

  it("requires both a token and a location ID", async () => {
    stubGhlFetch();

    await expect(connectAndProvision({ token: " ", locationId: testLocationId })).rejects.toThrow();
    await expect(connectAndProvision({ token: testToken, locationId: " " })).rejects.toThrow();
  });
});
