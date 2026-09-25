import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectAndProvision } from "@/lib/setup";
import { optionLabels } from "@/lib/ghl";
import { stubGhlFetch, testLocationId, testToken } from "./helpers";

beforeEach(() => {
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "a".repeat(64));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("option-bearing custom fields", () => {
  it("sends options as plain strings on the location route and verifies they stuck", async () => {
    const { state } = stubGhlFetch();

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    const service = result.record.fieldReports.find((report) => report.name === "Service");
    expect(service?.outcome).toBe("created");
    expect(result.created).toContain("field:Service");

    // GHL rejects the object form with "v.trim is not a function", so options must be
    // sent as bare strings.
    const create = state.calls.find(
      (call) => call.method === "POST" && call.url.includes(`/locations/${testLocationId}/customFields`) &&
        (call.body as { name?: string })?.name === "Budget"
    );
    expect((create?.body as { options?: unknown }).options).toEqual([
      "Under $500",
      "$500–$1,500",
      "$1,500–$3,000",
      "$3,000–$5,000",
      "$5,000+"
    ]);

    const options = result.record.manifest.customFieldOptions["Budget"];
    expect(options).toContain("$5,000+");
    expect(options).toHaveLength(5);
  });

  it("never calls the v3 custom-fields route, which 404s", async () => {
    const { state } = stubGhlFetch();

    await connectAndProvision({ token: testToken, locationId: testLocationId });

    expect(state.calls.filter((call) => call.url.endsWith("/custom-fields"))).toHaveLength(0);
  });

  it("gives the Existing Website checkbox real options", async () => {
    const { state } = stubGhlFetch();

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    const create = state.calls.find(
      (call) => call.method === "POST" && call.url.includes(`/locations/${testLocationId}/customFields`) &&
        (call.body as { name?: string })?.name === "Existing Website"
    );
    // CHECKBOX is a multi-select in GHL and is rejected outright without options.
    expect((create?.body as { dataType?: string }).dataType).toBe("CHECKBOX");
    expect((create?.body as { options?: unknown }).options).toEqual(["Yes", "No"]);
    expect(result.record.fieldReports.find((r) => r.name === "Existing Website")?.outcome).toBe("created");
  });

  it("reports created_missing_options instead of claiming success when GHL drops them", async () => {
    stubGhlFetch({}, { dropOptionsOnLocationRoute: true });

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    const budget = result.record.fieldReports.find((report) => report.name === "Budget");
    expect(budget?.outcome).toBe("created_missing_options");
    expect(result.created).not.toContain("field:Budget");
    expect(result.manualSteps.join(" ")).toContain("Budget");
    // Setup must not claim to be ready while scoring fields are unusable.
    expect(result.record.status).toBe("awaiting_assets");
  });

  it("flags an existing field that is missing options", async () => {
    const { state } = stubGhlFetch();
    state.customFields = [
      { id: "field-budget", name: "Budget", dataType: "SINGLE_OPTIONS", picklistOptions: ["$5,000+"] }
    ];

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    const budget = result.record.fieldReports.find((report) => report.name === "Budget");
    expect(budget?.outcome).toBe("existing");
    expect(budget?.detail).toContain("$3,000–$5,000");
    expect(result.manualSteps.join(" ")).toContain("Budget");
  });
});

describe("optionLabels", () => {
  it("normalises string options", () => {
    expect(optionLabels({ picklistOptions: ["  HOT ", "WARM"] })).toEqual(["hot", "warm"]);
  });

  it("normalises object options", () => {
    expect(optionLabels({ picklistOptions: [{ label: "HOT" }, { label: "NURTURE" }] })).toEqual(["hot", "nurture"]);
  });

  it("tolerates a missing or malformed list", () => {
    expect(optionLabels({})).toEqual([]);
    expect(optionLabels({ picklistOptions: undefined })).toEqual([]);
    expect(optionLabels({ picklistOptions: ["", { label: 7 } as never] })).toEqual([]);
  });
});
