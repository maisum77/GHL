import { describe, expect, it } from "vitest";
import { calculateLeadScore, pipelineStageFor } from "@/lib/scoring";
import type { LeadInput } from "@/lib/types";

type Scoreable = Pick<LeadInput, "budget" | "timeline" | "existingWebsite" | "challenge">;

function score(overrides: Partial<Scoreable> = {}) {
  return calculateLeadScore({
    budget: "Under $500",
    timeline: "Just researching",
    existingWebsite: false,
    challenge: "Other",
    ...overrides
  });
}

describe("calculateLeadScore", () => {
  it("classifies a high-intent lead as HOT", () => {
    expect(calculateLeadScore({
      budget: "$5,000+",
      timeline: "Immediately",
      existingWebsite: true,
      challenge: "Website isn't converting"
    })).toEqual({ score: 70, status: "HOT" });
  });

  it("classifies a mid-intent lead as WARM", () => {
    expect(calculateLeadScore({
      budget: "$1,500–$3,000",
      timeline: "Within 30 days",
      existingWebsite: true,
      challenge: "Other"
    })).toEqual({ score: 45, status: "WARM" });
  });

  it("classifies an early research lead as NURTURE", () => {
    expect(calculateLeadScore({
      budget: "Under $500",
      timeline: "Just researching",
      existingWebsite: false,
      challenge: "Other"
    })).toEqual({ score: 0, status: "NURTURE" });
  });
});

describe("budget bands", () => {
  it("scores each documented band", () => {
    expect(score({ budget: "Under $500" }).score).toBe(0);
    expect(score({ budget: "$500–$1,500" }).score).toBe(10);
    expect(score({ budget: "$1,500–$3,000" }).score).toBe(20);
    expect(score({ budget: "$3,000–$5,000" }).score).toBe(30);
    expect(score({ budget: "$5,000+" }).score).toBe(30);
  });
});

describe("timeline bands", () => {
  it("scores each documented band", () => {
    expect(score({ timeline: "Immediately" }).score).toBe(20);
    expect(score({ timeline: "Within 30 days" }).score).toBe(15);
    expect(score({ timeline: "1–3 months" }).score).toBe(0);
    expect(score({ timeline: "Just researching" }).score).toBe(0);
  });
});

describe("classification thresholds", () => {
  it("switches to WARM at exactly 40", () => {
    // $1,500–$3,000 (20) + Within 30 days (15) + existing site (10) = 45.
    expect(score({ budget: "$1,500–$3,000", timeline: "1–3 months", existingWebsite: true, challenge: "Other" }).score).toBe(30);
    expect(score({ budget: "$500–$1,500", timeline: "Within 30 days", existingWebsite: true, challenge: "Other" })).toEqual({
      score: 35,
      status: "NURTURE"
    });
    expect(score({ budget: "$1,500–$3,000", timeline: "Within 30 days", existingWebsite: true, challenge: "Other" })).toEqual({
      score: 45,
      status: "WARM"
    });
  });

  it("switches to HOT at exactly 70", () => {
    // $5,000+ (30) + Immediately (20) + existing site (10) + challenge (10) = 70.
    expect(score({ budget: "$5,000+", timeline: "Immediately", existingWebsite: true, challenge: "Need automation" })).toEqual({
      score: 70,
      status: "HOT"
    });
    // One point lower must not be HOT.
    expect(score({ budget: "$5,000+", timeline: "Immediately", existingWebsite: true, challenge: "Other" }).score).toBe(60);
  });

  it("awards the challenge point only for a specific challenge", () => {
    expect(score({ challenge: "Other" }).score).toBe(0);
    expect(score({ challenge: "Need automation" }).score).toBe(10);
  });

  it("never produces a negative or non-finite score", () => {
    const result = score();
    expect(Number.isFinite(result.score)).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});

describe("pipelineStageFor", () => {
  it("opens hot leads at Qualified and everything else at New Lead", () => {
    expect(pipelineStageFor("HOT")).toBe("Qualified");
    expect(pipelineStageFor("WARM")).toBe("New Lead");
    expect(pipelineStageFor("NURTURE")).toBe("New Lead");
  });
});
