import { z } from "zod";
import { leadBudgetValues, leadTimelineValues } from "./scoring";

const optionalUrl = z.union([z.string().trim().url(), z.literal("")]);

export const setupInputSchema = z.object({
  accessCode: z.string().trim().min(1, "Enter the setup access code"),
  token: z.string().trim().min(20, "Enter a valid GHL Private Integration token"),
  locationId: z.string().trim().min(4, "Enter the GHL Location ID"),
  formUrl: optionalUrl.optional(),
  bookingUrl: optionalUrl.optional(),
  nurtureWorkflowId: z.string().trim().max(64).optional(),
  nurtureTrigger: z.enum(["enroll", "tag"]).optional(),
  calendarHostUserId: z.string().trim().max(64).optional()
});

const existingWebsiteValue = z.union([z.boolean(), z.enum(["true", "false", "yes", "no"])]);

export const leadInputSchema = z.object({
  name: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(40).optional(),
  company: z.string().trim().max(120).optional(),
  website: z.string().trim().max(240).optional(),
  service: z.string().trim().min(1, "Choose a service"),
  challenge: z.string().trim().min(1, "Choose a challenge"),
  budget: z.enum(leadBudgetValues),
  timeline: z.enum(leadTimelineValues),
  existingWebsite: existingWebsiteValue.transform((value) => value === true || value === "true" || value === "yes"),
  message: z.string().trim().max(2000).optional(),
  utmSource: z.string().trim().max(120).optional(),
  utmMedium: z.string().trim().max(120).optional(),
  utmCampaign: z.string().trim().max(120).optional(),
  landingPage: z.string().trim().max(240).optional()
});

export type ValidatedSetupInput = z.infer<typeof setupInputSchema>;
export type ValidatedLeadInput = z.infer<typeof leadInputSchema>;
