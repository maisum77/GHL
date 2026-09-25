import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/dashboard/route";
import { createSessionValue } from "@/lib/auth";
import { encryptSecret } from "@/lib/crypto";
import { makeInstallation, resetMemoryInstallation, testLocationId, testToken } from "./helpers";
import { saveInstallation } from "@/lib/db";

const PIPELINE_ID = "pipeline-1";
const STAGE_QUALIFIED = "stage-qualified";
const STAGE_OTHER_PIPELINE = "stage-marketing-hot";

/**
 * `/opportunities/search` returns pipelineId and pipelineStageId but no names, so the route
 * has to resolve them. Without this the dashboard renders "Stage not mapped" for every row.
 */
function stubSearch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/opportunities/search")) {
      return Response.json({
        total: 2,
        opportunities: [
          { id: "opp-1", name: "Alex — Acme", status: "open", pipelineId: PIPELINE_ID, pipelineStageId: STAGE_QUALIFIED },
          { id: "opp-2", name: "Sam — Beta", status: "open", pipelineId: "other-pipeline", pipelineStageId: STAGE_OTHER_PIPELINE }
        ]
      });
    }
    if (url.includes("/opportunities/pipelines")) {
      return Response.json({
        pipelines: [
          { id: PIPELINE_ID, name: "Agency Funnel", stages: [{ id: STAGE_QUALIFIED, name: "Qualified" }] },
          { id: "other-pipeline", name: "Marketing Pipeline", stages: [{ id: STAGE_OTHER_PIPELINE, name: "Hot Lead" }] }
        ]
      });
    }
    return Response.json({});
  });
}

function request() {
  return new NextRequest("https://funnel.test/api/dashboard", {
    headers: { cookie: `ghl_setup_session=${createSessionValue()}` }
  });
}

beforeEach(async () => {
  resetMemoryInstallation();
  vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "a".repeat(64));
  await saveInstallation(
    makeInstallation({
      encryptedToken: encryptSecret(testToken, testLocationId),
      manifest: {
        ...makeInstallation().manifest,
        pipelineId: PIPELINE_ID,
        pipelineStageIds: { Qualified: STAGE_QUALIFIED }
      }
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  resetMemoryInstallation();
});

describe("GET /api/dashboard", () => {
  it("resolves stage names for every pipeline in the location", async () => {
    vi.stubGlobal("fetch", stubSearch());

    const body = await (await GET(request())).json();

    expect(body.opportunities).toHaveLength(2);
    expect(body.opportunities[0].pipelineStageName).toBe("Qualified");
    // Not just the connected pipeline: opportunities from other pipelines must resolve too.
    expect(body.opportunities[1].pipelineStageName).toBe("Hot Lead");
  });

  it("reports the opportunity total, not a lead count", async () => {
    vi.stubGlobal("fetch", stubSearch());

    const body = await (await GET(request())).json();

    expect(body.opportunityTotal).toBe(2);
    expect(body.leads).toBeUndefined();
  });

  it("falls back to the manifest stage ids when pipelines cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/opportunities/search")) {
          return Response.json({
            total: 1,
            opportunities: [{ id: "opp-1", name: "Alex — Acme", status: "open", pipelineStageId: STAGE_QUALIFIED }]
          });
        }
        if (url.includes("/opportunities/pipelines")) {
          return Response.json({ message: "nope" }, { status: 403 });
        }
        return Response.json({});
      })
    );

    const body = await (await GET(request())).json();

    expect(body.opportunities[0].pipelineStageName).toBe("Qualified");
  });

  it("still returns rows when a stage cannot be resolved at all", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/opportunities/search")) {
          return Response.json({
            total: 1,
            opportunities: [{ id: "opp-1", name: "Alex — Acme", status: "open", pipelineStageId: "stage-deleted" }]
          });
        }
        if (url.includes("/opportunities/pipelines")) {
          return Response.json({ pipelines: [] });
        }
        return Response.json({});
      })
    );

    const body = await (await GET(request())).json();

    expect(body.opportunities[0].pipelineStageName).toBeUndefined();
    expect(body.opportunities[0].name).toBe("Alex — Acme");
  });
});
