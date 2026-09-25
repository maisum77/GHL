import { appConfig } from "./config";
import type {
  GhlCalendarConfig,
  GhlCustomField,
  GhlLocation,
  GhlNamedResource,
  GhlPipeline,
  GhlTag
} from "./types";

export class GhlApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "GhlApiError";
    this.status = status;
  }
}

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function arrayFrom<T>(payload: unknown, key: string): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }
  if (isRecord(payload) && Array.isArray(payload[key])) {
    return payload[key] as T[];
  }
  return [];
}

function objectFrom<T>(payload: unknown, key: string): T | null {
  if (!isRecord(payload)) {
    return null;
  }
  if (isRecord(payload[key])) {
    return payload[key] as T;
  }
  return payload as T;
}

/**
 * GHL returns picklist options inconsistently: sometimes as plain strings, sometimes as
 * `{ label }` objects. Normalise both to a lowercased label list for comparison.
 */
export function optionLabels(field: Pick<GhlCustomField, "picklistOptions">): string[] {
  const raw = field.picklistOptions;
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((option) => {
      if (typeof option === "string") {
        return option;
      }
      if (isRecord(option) && typeof option.label === "string") {
        return option.label;
      }
      return "";
    })
    .filter((label) => label.length > 0)
    .map((label) => normalizedLabel(label));
}

function normalizedLabel(value: string): string {
  return value.trim().toLocaleLowerCase();
}

export class GhlClient {
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly version: string;

  constructor(token: string, locationId?: string) {
    this.token = token;
    this.baseUrl = appConfig.ghlBaseUrl.replace(/\/$/, "");
    this.version = appConfig.ghlApiVersion;
    this.locationId = locationId;
  }

  private readonly locationId?: string;

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.token}`);
    headers.set("Accept", "application/json");
    headers.set("Version", this.version);
    if (init.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(15000)
    });
    const rawBody = await response.text();
    let payload: unknown = null;
    if (rawBody) {
      try {
        payload = JSON.parse(rawBody);
      } catch {
        payload = null;
      }
    }

    if (!response.ok) {
      const message = isRecord(payload) && typeof payload.message === "string" ? payload.message : `GHL request failed with status ${response.status}`;
      throw new GhlApiError(message, response.status);
    }

    return payload as T;
  }

  async getLocation(locationId = this.locationId): Promise<GhlLocation> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>(`/locations/${encodeURIComponent(locationId)}`);
    const location = objectFrom<GhlLocation>(payload, "location");
    if (!location) {
      throw new GhlApiError("GHL returned an invalid location response", 502);
    }
    return location;
  }

  async getCustomFields(locationId = this.locationId): Promise<GhlCustomField[]> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>(`/locations/${encodeURIComponent(locationId)}/customFields?model=contact`);
    return arrayFrom<GhlCustomField>(payload, "customFields");
  }

  /**
   * The location-scoped create route only understands `textBoxListOptions`, which GHL
   * silently discards for SINGLE_OPTIONS fields. The v3 route accepts `options` instead,
   * so option-bearing fields try that first and fall back to the location route.
   */
  async createCustomFieldWithOptions(
    locationId: string,
    name: string,
    options: string[]
  ): Promise<GhlCustomField> {
    const body = {
      locationId,
      name,
      dataType: "SINGLE_OPTIONS",
      model: "contact",
      placeholder: name,
      showInForms: true,
      options: options.map((label) => ({ key: label, label }))
    };
    const payload = await this.request<unknown>("/custom-fields", {
      method: "POST",
      body: JSON.stringify(body)
    });
    const field = objectFrom<GhlCustomField>(payload, "customField") ?? objectFrom<GhlCustomField>(payload, "field");
    if (!field) {
      throw new GhlApiError("GHL returned an invalid custom field response", 502);
    }
    return field;
  }

  async getTags(locationId = this.locationId): Promise<GhlTag[]> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>(`/locations/${encodeURIComponent(locationId)}/tags`);
    return arrayFrom<GhlTag>(payload, "tags");
  }

  async getPipelines(locationId = this.locationId): Promise<GhlPipeline[]> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>(`/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`);
    return arrayFrom<GhlPipeline>(payload, "pipelines");
  }

  async getForms(locationId = this.locationId): Promise<GhlNamedResource[]> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>(`/forms/?locationId=${encodeURIComponent(locationId)}&limit=50`);
    return arrayFrom<GhlNamedResource>(payload, "forms");
  }

  async getWorkflows(locationId = this.locationId): Promise<GhlNamedResource[]> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>(`/workflows/?locationId=${encodeURIComponent(locationId)}`);
    return arrayFrom<GhlNamedResource>(payload, "workflows");
  }

  async getCalendars(locationId = this.locationId): Promise<GhlNamedResource[]> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>(`/calendars/?locationId=${encodeURIComponent(locationId)}`);
    return arrayFrom<GhlNamedResource>(payload, "calendars");
  }

  async getUsers(locationId = this.locationId): Promise<GhlNamedResource[]> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>(`/users/?locationId=${encodeURIComponent(locationId)}`);
    return arrayFrom<GhlNamedResource>(payload, "users");
  }

  async createCustomField(locationId: string, name: string, dataType: string, options?: string[]): Promise<GhlCustomField> {
    const body: Record<string, unknown> = {
      name,
      dataType,
      model: "contact",
      placeholder: name
    };
    if (options?.length) {
      body.textBoxListOptions = options.map((label) => ({ label, prefillValue: label }));
    }
    const payload = await this.request<unknown>(`/locations/${encodeURIComponent(locationId)}/customFields`, {
      method: "POST",
      body: JSON.stringify(body)
    });
    const field = objectFrom<GhlCustomField>(payload, "customField");
    if (!field) {
      throw new GhlApiError("GHL returned an invalid custom field response", 502);
    }
    return field;
  }

  async createTag(locationId: string, name: string): Promise<GhlTag> {
    const payload = await this.request<unknown>(`/locations/${encodeURIComponent(locationId)}/tags`, {
      method: "POST",
      body: JSON.stringify({ name })
    });
    const tag = objectFrom<GhlTag>(payload, "tag");
    if (!tag) {
      throw new GhlApiError("GHL returned an invalid tag response", 502);
    }
    return tag;
  }

  async createPipeline(locationId: string, name: string, stages: string[]): Promise<GhlPipeline> {
    const payload = await this.request<unknown>("/opportunities/pipelines", {
      method: "POST",
      body: JSON.stringify({
        name,
        locationId,
        stages: stages.map((stageName, index) => ({
          name: stageName,
          position: index + 1,
          showInFunnel: true
        })),
        showInFunnel: true,
        showInPieChart: true,
        useOpportunityProbability: true
      })
    });
    const pipeline = objectFrom<GhlPipeline>(payload, "pipeline") ?? (isRecord(payload) ? (payload as GhlPipeline) : null);
    if (!pipeline) {
      throw new GhlApiError("GHL returned an invalid pipeline response", 502);
    }
    return pipeline;
  }

  async createCalendar(locationId: string, config: GhlCalendarConfig): Promise<GhlNamedResource> {
    const payload = await this.request<unknown>("/calendars/", {
      method: "POST",
      body: JSON.stringify({ ...config, locationId })
    });
    const calendar = objectFrom<GhlNamedResource>(payload, "calendar") ?? objectFrom<GhlNamedResource>(payload, "data");
    if (!calendar) {
      throw new GhlApiError("GHL returned an invalid calendar response", 502);
    }
    return calendar;
  }

  async addContactTags(contactId: string, tags: string[]): Promise<void> {
    if (tags.length === 0) {
      return;
    }
    // Deliberately not the upsert `tags` property, which overwrites every existing tag.
    await this.request<unknown>(`/contacts/${encodeURIComponent(contactId)}/tags`, {
      method: "POST",
      body: JSON.stringify({ tags })
    });
  }

  async createOpportunity(input: {
    locationId: string;
    contactId: string;
    pipelineId: string;
    pipelineStageId?: string;
    name: string;
    status?: string;
  }): Promise<JsonRecord> {
    const payload = await this.request<unknown>("/opportunities/", {
      method: "POST",
      body: JSON.stringify({
        locationId: input.locationId,
        contactId: input.contactId,
        pipelineId: input.pipelineId,
        pipelineStageId: input.pipelineStageId,
        name: input.name,
        status: input.status ?? "open"
      })
    });
    return isRecord(payload) ? payload : {};
  }

  async enrollContactInWorkflow(contactId: string, workflowId: string, eventStartTime?: string): Promise<void> {
    await this.request<unknown>(
      `/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(workflowId)}`,
      {
        method: "POST",
        body: JSON.stringify(eventStartTime ? { eventStartTime } : {})
      }
    );
  }

  async searchOpportunities(locationId = this.locationId): Promise<{ opportunities: JsonRecord[]; total: number; stageAggregations: JsonRecord[] }> {
    if (!locationId) {
      throw new Error("A GHL location ID is required");
    }
    const payload = await this.request<unknown>("/opportunities/search", {
      method: "POST",
      body: JSON.stringify({
        locationId,
        query: "",
        limit: 100,
        page: 0,
        additionalDetails: {
          notes: false,
          tasks: false,
          calendarEvents: false
        }
      })
    });
    if (!isRecord(payload)) {
      return { opportunities: [], total: 0, stageAggregations: [] };
    }
    return {
      opportunities: arrayFrom<JsonRecord>(payload, "opportunities"),
      total: typeof payload.total === "number" ? payload.total : 0,
      stageAggregations: arrayFrom<JsonRecord>(payload, "stageAggregations")
    };
  }

  async upsertContact(locationId: string, payload: Record<string, unknown>): Promise<JsonRecord> {
    const response = await this.request<unknown>("/contacts/upsert", {
      method: "POST",
      body: JSON.stringify({ ...payload, locationId })
    });
    return isRecord(response) ? response : {};
  }
}
