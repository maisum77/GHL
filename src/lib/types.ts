export type SetupStatus = "locked" | "connected" | "awaiting_assets" | "ready" | "degraded";

export type ResourceState = "created" | "existing" | "manual" | "failed";

export interface GhlLocation {
  id: string;
  name?: string;
  companyId?: string;
  timezone?: string;
  [key: string]: unknown;
}

export interface GhlCustomField {
  id: string;
  name: string;
  dataType?: string;
  model?: string;
  fieldKey?: string;
  picklistOptions?: Array<string | { label?: string }>;
  [key: string]: unknown;
}

export interface GhlTag {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface GhlPipelineStage {
  id: string;
  name: string;
  position?: number;
  [key: string]: unknown;
}

export interface GhlPipeline {
  id: string;
  name: string;
  stages?: GhlPipelineStage[];
  [key: string]: unknown;
}

export interface GhlNamedResource {
  id: string;
  name: string;
  status?: string;
  [key: string]: unknown;
}

export interface GhlCalendarConfig {
  name: string;
  calendarType?: string;
  description?: string;
  slotDuration?: number;
  slotDurationUnit?: string;
  slotInterval?: number;
  slotIntervalUnit?: string;
  appointmentPerSlot?: number;
  appointmentPerDay?: number;
  allowBookingAfter?: number;
  allowBookingAfterUnit?: string;
  allowBookingFor?: number;
  allowBookingForUnit?: string;
  allowReschedule?: boolean;
  allowCancellation?: boolean;
  autoConfirm?: boolean;
  isActive?: boolean;
  teamMembers?: Array<{
    userId: string;
    priority?: number;
    isPrimary?: boolean;
  }>;
  [key: string]: unknown;
}

export type FieldProvisioning =
  | "created"
  | "created_missing_options"
  | "existing"
  | "failed";

export interface FieldReport {
  name: string;
  outcome: FieldProvisioning;
  detail?: string;
}

/**
 * How the nurture workflow starts. `enroll` is the app calling GHL's enrollment endpoint on
 * every lead, which requires the workflow to contain its own If/Else. `tag` means the workflow
 * fires from a Contact Tag trigger instead, so the app must not enroll or every lead would
 * enter the workflow twice.
 */
export type NurtureTriggerMode = "enroll" | "tag";

export interface ResourceManifest {
  customFields: Record<string, string>;
  customFieldOptions: Record<string, string[]>;
  tags: Record<string, string>;
  pipelineId?: string;
  pipelineStageIds: Record<string, string>;
  calendarId?: string;
  calendarName?: string;
  nurtureWorkflowId?: string;
  nurtureTrigger?: NurtureTriggerMode;
  forms: GhlNamedResource[];
  workflows: GhlNamedResource[];
  calendars: GhlNamedResource[];
  users: GhlNamedResource[];
}

export interface SetupRecord {
  id: string;
  locationId: string;
  locationName: string;
  companyId?: string;
  encryptedToken: string;
  tokenFingerprint: string;
  formUrl: string;
  bookingUrl: string;
  status: SetupStatus;
  manifest: ResourceManifest;
  fieldReports: FieldReport[];
  warnings: string[];
  manualSteps: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicSetupConfig {
  connected: boolean;
  status: SetupStatus;
  formUrl: string;
  bookingUrl: string;
  locationName?: string;
}

export interface LeadInput {
  name: string;
  email: string;
  phone?: string;
  company?: string;
  website?: string;
  service: string;
  challenge: string;
  budget: string;
  timeline: string;
  existingWebsite: boolean;
  message?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  landingPage?: string;
}

export interface LeadResult {
  score: number;
  status: "HOT" | "WARM" | "NURTURE";
}
