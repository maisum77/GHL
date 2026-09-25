import type { LeadInput, LeadResult } from "./types";

export const leadBudgetValues = [
  "Under $500",
  "$500–$1,500",
  "$1,500–$3,000",
  "$3,000–$5,000",
  "$5,000+"
] as const;

export const leadTimelineValues = ["Immediately", "Within 30 days", "1–3 months", "Just researching"] as const;

export function calculateLeadScore(input: Pick<LeadInput, "budget" | "timeline" | "existingWebsite" | "challenge">): LeadResult {
  let score = 0;

  if (input.budget === "$3,000–$5,000" || input.budget === "$5,000+") {
    score += 30;
  } else if (input.budget === "$1,500–$3,000") {
    score += 20;
  } else if (input.budget === "$500–$1,500") {
    score += 10;
  }

  if (input.timeline === "Immediately") {
    score += 20;
  } else if (input.timeline === "Within 30 days") {
    score += 15;
  }

  if (input.existingWebsite) {
    score += 10;
  }

  if (input.challenge && input.challenge !== "Other") {
    score += 10;
  }

  return {
    score,
    status: score >= 70 ? "HOT" : score >= 40 ? "WARM" : "NURTURE"
  };
}

/**
 * Maps a classification to the pipeline stage the opportunity should open in. Anything
 * that has not cleared the HOT threshold starts at the top of the funnel so the agency
 * can qualify it further inside GHL.
 */
export function pipelineStageFor(status: LeadResult["status"]): string {
  return status === "HOT" ? "Qualified" : "New Lead";
}
