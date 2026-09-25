import { NextRequest, NextResponse } from "next/server";
import { hasValidSession } from "@/lib/auth";
import { decryptSecret } from "@/lib/crypto";
import { getInstallation } from "@/lib/db";
import { GhlClient } from "@/lib/ghl";

export const runtime = "nodejs";

type OpportunitySummary = {
  id?: string;
  name?: string;
  status?: string;
  pipelineStageId?: string;
  pipelineStageName?: string;
};

export async function GET(request: NextRequest) {
  if (!hasValidSession(request)) {
    return NextResponse.json({ error: "A valid setup session is required" }, { status: 401 });
  }

  const installation = await getInstallation();
  if (!installation) {
    return NextResponse.json({ connected: false, opportunityTotal: 0, opportunities: [] });
  }

  const response: {
    connected: boolean;
    locationName: string;
    opportunityTotal: number;
    opportunities: OpportunitySummary[];
    error?: string;
  } = {
    connected: true,
    locationName: installation.locationName,
    opportunityTotal: 0,
    opportunities: []
  };

  try {
    const token = decryptSecret(installation.encryptedToken, installation.locationId);
    const client = new GhlClient(token, installation.locationId);
    const result = await client.searchOpportunities();

    // The search endpoint returns pipelineId and pipelineStageId but never the names, so
    // resolve them from the location's pipelines. Built from every pipeline, not just the
    // connected one, because the location may hold opportunities we did not create.
    const stageNames = new Map<string, string>();
    try {
      for (const pipeline of await client.getPipelines()) {
        for (const stage of pipeline.stages ?? []) {
          if (stage.id) {
            stageNames.set(stage.id, stage.name);
          }
        }
      }
    } catch {
      // Fall back to the connected pipeline's stages from setup.
      for (const [name, id] of Object.entries(installation.manifest.pipelineStageIds)) {
        stageNames.set(id, name);
      }
    }

    response.opportunityTotal = result.total;
    response.opportunities = result.opportunities.slice(0, 8).map((opportunity) => {
      const summary = opportunity as OpportunitySummary;
      return {
        id: summary.id,
        name: summary.name,
        status: summary.status,
        pipelineStageId: summary.pipelineStageId,
        pipelineStageName: summary.pipelineStageId ? stageNames.get(summary.pipelineStageId) : undefined
      };
    });
  } catch (error) {
    response.error = error instanceof Error ? error.message.slice(0, 160) : "GHL metrics are temporarily unavailable";
  }

  return NextResponse.json(response);
}
