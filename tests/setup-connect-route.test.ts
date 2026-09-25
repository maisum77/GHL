import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "@/app/api/setup/connect/route";
import { stubGhlFetch, testLocationId, testToken } from "./helpers";

let requestCounter = 0;

function post(body: Record<string, unknown>) {
  requestCounter += 1;
  return POST(
    new NextRequest("https://funnel.test/api/setup/connect", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": `198.51.100.${requestCounter % 250}` },
      body: JSON.stringify(body)
    })
  );
}

const validBody = {
  accessCode: "test-setup-code",
  token: testToken,
  locationId: testLocationId,
  formUrl: "https://forms.example/qualification",
  bookingUrl: "https://calendar.example/discovery"
};

beforeEach(() => {
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/setup/connect", () => {
  it("provisions and returns a non-secret result", async () => {
    stubGhlFetch();

    const response = await post(validBody);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.locationName).toBe("Client location");
    expect(body.created).toContain("pipeline:Agency Funnel");
    expect(body.created).toContain("tag:HOT");
    expect(body.fieldReports).toBeInstanceOf(Array);
    expect(response.cookies.get("ghl_setup_session")).toBeDefined();
  });

  it("never returns the token or the encrypted credential", async () => {
    stubGhlFetch();

    const response = await post(validBody);
    const serialised = JSON.stringify(await response.json());

    expect(serialised).not.toContain(testToken);
    expect(serialised).not.toContain("encryptedToken");
    expect(serialised).not.toContain("v1.");
  });

  it("rejects a body that fails validation", async () => {
    stubGhlFetch();

    const response = await post({ ...validBody, token: "short" });
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBeTruthy();
  });

  it("rejects a bad access code before touching GHL", async () => {
    const { fetchMock } = stubGhlFetch();

    const response = await post({ ...validBody, accessCode: "wrong" });
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toContain("access code");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throttles repeated attempts from one client", async () => {
    stubGhlFetch();
    const headers = { "content-type": "application/json", "x-forwarded-for": "192.0.2.77" };
    const send = () =>
      POST(
        new NextRequest("https://funnel.test/api/setup/connect", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...validBody, accessCode: "wrong" })
        })
      );

    const statuses: number[] = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      statuses.push((await send()).status);
    }

    expect(statuses.slice(0, 5).every((status) => status === 401)).toBe(true);
    expect(statuses[5]).toBe(429);
  });

  it("surfaces a GHL failure without leaking the token", async () => {
    stubGhlFetch({
      [`https://services.leadconnectorhq.com/locations/${testLocationId}`]: () =>
        Response.json({ message: `bad token ${testToken}` }, { status: 401 })
    });

    const response = await post(validBody);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(JSON.stringify(body)).not.toContain(testToken);
    expect(body.error).toContain("[redacted]");
  });

  it("reports a token that points at a different location", async () => {
    stubGhlFetch({
      [`https://services.leadconnectorhq.com/locations/${testLocationId}`]: () =>
        Response.json({ id: "some-other-location", name: "Elsewhere" })
    });

    const response = await post(validBody);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("does not match");
  });
});
