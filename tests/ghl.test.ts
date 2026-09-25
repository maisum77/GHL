import { afterEach, describe, expect, it, vi } from "vitest";
import { GhlApiError, GhlClient } from "@/lib/ghl";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GhlClient", () => {
  it("uses the versioned location endpoint and bearer authorization", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "location-1", name: "Client location" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GhlClient("private-token", "location-1");
    const location = await client.getLocation();

    expect(location.name).toBe("Client location");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://services.leadconnectorhq.com/locations/location-1",
      expect.objectContaining({
        headers: expect.any(Headers),
        cache: "no-store"
      })
    );
    const headers = fetchMock.mock.calls[0][1].headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer private-token");
    expect(headers.get("Version")).toBe("v3");
  });

  it("turns unsuccessful GHL responses into typed errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Forbidden" }), { status: 403 })));
    const client = new GhlClient("private-token", "location-1");

    await expect(client.getLocation()).rejects.toEqual(new GhlApiError("Forbidden", 403));
  });

  it("omits searchAfter when there is no cursor", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ opportunities: [], total: 0 })));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GhlClient("private-token", "location-1");

    await client.searchOpportunities();

    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(body).not.toHaveProperty("searchAfter");
    expect(body).toMatchObject({ locationId: "location-1", query: "", limit: 100, page: 0 });
  });
});

describe("GhlClient writes", () => {
  it("adds tags through the dedicated route, not the upsert field", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ tags: ["HOT"] })));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GhlClient("private-token", "location-1");

    await client.addContactTags("contact-1", ["HOT"]);

    expect(fetchMock.mock.calls[0][0]).toBe("https://services.leadconnectorhq.com/contacts/contact-1/tags");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ tags: ["HOT"] });
  });

  it("skips the request entirely when there are no tags", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const client = new GhlClient("private-token", "location-1");

    await client.addContactTags("contact-1", []);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("creates an opportunity with the required identifiers", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "opp-1" })));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GhlClient("private-token", "location-1");

    await client.createOpportunity({
      locationId: "location-1",
      contactId: "contact-1",
      pipelineId: "pipeline-1",
      pipelineStageId: "stage-1",
      name: "Alex Morgan"
    });

    expect(fetchMock.mock.calls[0][0]).toBe("https://services.leadconnectorhq.com/opportunities/");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      locationId: "location-1",
      contactId: "contact-1",
      pipelineId: "pipeline-1",
      pipelineStageId: "stage-1",
      name: "Alex Morgan",
      status: "open"
    });
  });

  it("enrolls a contact in a workflow", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true })));
    vi.stubGlobal("fetch", fetchMock);
    const client = new GhlClient("private-token", "location-1");

    await client.enrollContactInWorkflow("contact-1", "workflow-1", "2026-01-01T00:00:00.000Z");

    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://services.leadconnectorhq.com/contacts/contact-1/workflow/workflow-1"
    );
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ eventStartTime: "2026-01-01T00:00:00.000Z" });
  });

  it("posts option-bearing fields to the v3 route with an options array", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ customField: { id: "f1", name: "Budget" } }), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new GhlClient("private-token", "location-1");

    await client.createCustomFieldWithOptions("location-1", "Budget", ["$5,000+", "Other"]);

    expect(fetchMock.mock.calls[0][0]).toBe("https://services.leadconnectorhq.com/custom-fields");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({
      locationId: "location-1",
      name: "Budget",
      dataType: "SINGLE_OPTIONS",
      model: "contact",
      placeholder: "Budget",
      showInForms: true,
      options: [
        { key: "$5,000+", label: "$5,000+" },
        { key: "Other", label: "Other" }
      ]
    });
  });

  it("creates a calendar with the location applied to the body", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ calendar: { id: "cal-1", name: "Discovery Call" } }), { status: 201 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const client = new GhlClient("private-token", "location-1");

    await client.createCalendar("location-1", { name: "Discovery Call", slotDuration: 30 });

    expect(fetchMock.mock.calls[0][0]).toBe("https://services.leadconnectorhq.com/calendars/");
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body)) as Record<string, unknown>;
    expect(body.locationId).toBe("location-1");
    expect(body.slotDuration).toBe(30);
  });
});
