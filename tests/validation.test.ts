import { describe, expect, it } from "vitest";
import { leadInputSchema, setupInputSchema } from "@/lib/validation";

describe("request validation", () => {
  it("normalizes the website checkbox from a form string", () => {
    const result = leadInputSchema.parse({
      name: "Alex Morgan",
      email: "alex@example.com",
      service: "CRM / Funnel",
      challenge: "Need automation",
      budget: "$5,000+",
      timeline: "Immediately",
      existingWebsite: "yes"
    });
    expect(result.existingWebsite).toBe(true);
  });

  it("rejects an invalid setup token", () => {
    const result = setupInputSchema.safeParse({
      accessCode: "code",
      token: "short",
      locationId: "location"
    });
    expect(result.success).toBe(false);
  });
});
