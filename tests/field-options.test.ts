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
  it("creates SINGLE_OPTIONS fields through the v3 route and verifies the options stuck", async () => {
    const { state } = stubGhlFetch();

    const result = await connectAndProvision({ token: testToken, locationId: testLocationId });

    const service = result.record.fieldReports.find((report) => report.name === "Service");
    expect(service?.outcome).toBe("created");
    expect(result.created).toContain("field:Service");

    // The v3 route is the one that accepts `options`.
    const v3Calls = state.calls.filter((call) => call.url.endsWith("/custom-fields"));
    expect(v3Calls.length).toBeGreaterThan(0);

    const options = result.record.manifest.customFieldOptions["Budget"];
    expect(options).toContain("$5,000+");
    expect(options).toHaveLength(5);
  });

  it("falls back to the location route when the v3 route rejects the token", async () => {
    const { state } = stubGhlFetch({
      "https://services.leadconnectorhq.com/custom-fields": () =>
        Response.json({ message: "Forbidden" }, { status: 403 })
    });

    await connectAndProvision({ token: testToken, locationId: testLocationId });

    const locationRouteCalls = state.calls.filter(
      (call) => call.method === "POST" && call.url.includes(`/locations/${testLocationId}/customFields`)
    );
    expect(locationRouteCalls.length).toBeGreaterThan(0);
  });

  it("reports created_missing_options instead of claiming success when GHL drops them", async () => {
    // GHL answers 201 for a SINGLE_OPTIONS field on the location route but stores no
    // options, because textBoxListOptions only applies to TEXTBOX_LIST.
    stubGhlFetch(
      {
        "https://services.leadconnectorhq.com/custom-fields": () =>
          Response.json({ message: "Forbidden" }, { status: 403 })
      },
      { dropOptionsOnLocationRoute: true }
    );

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
