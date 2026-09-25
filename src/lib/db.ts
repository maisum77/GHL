import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { appConfig, assertProductionConfig, hasDatabase } from "./config";
import { databaseSchema } from "./db-schema";
import type { FieldReport, ResourceManifest, SetupRecord } from "./types";

type Sql = ReturnType<typeof postgres>;
type JsonValue = Parameters<Sql["json"]>[0];

type InstallationRow = {
  id: string;
  location_id: string;
  location_name: string;
  company_id: string | null;
  encrypted_token: string;
  token_fingerprint: string;
  form_url: string;
  booking_url: string;
  status: SetupRecord["status"];
  manifest: ResourceManifest;
  field_reports: FieldReport[] | null;
  warnings: string[];
  manual_steps: string[];
  created_at: Date | string;
  updated_at: Date | string;
};

let sqlClient: Sql | null = null;
const globalState = globalThis as typeof globalThis & {
  __ghlFunnelMemoryInstallation?: SetupRecord;
  __ghlFunnelSchemaReady?: Promise<unknown>;
};

function database(): Sql | null {
  if (!hasDatabase()) {
    return null;
  }
  if (!sqlClient) {
    sqlClient = postgres(appConfig.databaseUrl, {
      max: 1,
      prepare: false,
      idle_timeout: 20,
      connect_timeout: 10
    });
  }
  return sqlClient;
}

/**
 * Runs the DDL once per instance. Every read and write depends on these tables existing,
 * but re-sending the script on each call costs three extra round-trips per request.
 * A rejected promise is cleared so a transient failure can be retried.
 */
async function ensureSchema(): Promise<Sql | null> {
  const sql = database();
  if (!sql) {
    return null;
  }
  if (!globalState.__ghlFunnelSchemaReady) {
    globalState.__ghlFunnelSchemaReady = sql.unsafe(databaseSchema).catch((error: unknown) => {
      globalState.__ghlFunnelSchemaReady = undefined;
      throw error;
    });
  }
  await globalState.__ghlFunnelSchemaReady;
  return sql;
}

function dateValue(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function fromRow(row: InstallationRow): SetupRecord {
  return {
    id: row.id,
    locationId: row.location_id,
    locationName: row.location_name,
    companyId: row.company_id ?? undefined,
    encryptedToken: row.encrypted_token,
    tokenFingerprint: row.token_fingerprint,
    formUrl: row.form_url,
    bookingUrl: row.booking_url,
    status: row.status,
    manifest: row.manifest,
    fieldReports: row.field_reports ?? [],
    warnings: row.warnings ?? [],
    manualSteps: row.manual_steps ?? [],
    createdAt: dateValue(row.created_at),
    updatedAt: dateValue(row.updated_at)
  };
}

export async function getInstallation(): Promise<SetupRecord | null> {
  const sql = database();
  if (!sql) {
    return globalState.__ghlFunnelMemoryInstallation ?? null;
  }

  await ensureSchema();
  const rows = await sql<InstallationRow[]>`select * from installations order by updated_at desc limit 1`;
  return rows[0] ? fromRow(rows[0]) : null;
}

export async function saveInstallation(record: SetupRecord): Promise<void> {
  const sql = database();
  if (!sql) {
    if (process.env.NODE_ENV === "production") {
      assertProductionConfig();
      throw new Error("DATABASE_URL is required to save setup state in production");
    }
    globalState.__ghlFunnelMemoryInstallation = record;
    return;
  }

  await ensureSchema();
  await sql`
    insert into installations (
      id, location_id, location_name, company_id, encrypted_token, token_fingerprint,
      form_url, booking_url, status, manifest, field_reports, warnings, manual_steps, created_at, updated_at
    ) values (
      ${record.id}, ${record.locationId}, ${record.locationName}, ${record.companyId ?? null},
      ${record.encryptedToken}, ${record.tokenFingerprint}, ${record.formUrl}, ${record.bookingUrl},
      ${record.status}, ${sql.json(record.manifest as unknown as JsonValue)}, ${sql.json(record.fieldReports as unknown as JsonValue)}, ${sql.json(record.warnings as unknown as JsonValue)}, ${sql.json(record.manualSteps as unknown as JsonValue)},
      ${record.createdAt}, ${record.updatedAt}
    )
    on conflict (id) do update set
      location_id = excluded.location_id,
      location_name = excluded.location_name,
      company_id = excluded.company_id,
      encrypted_token = excluded.encrypted_token,
      token_fingerprint = excluded.token_fingerprint,
      form_url = excluded.form_url,
      booking_url = excluded.booking_url,
      status = excluded.status,
      manifest = excluded.manifest,
      field_reports = excluded.field_reports,
      warnings = excluded.warnings,
      manual_steps = excluded.manual_steps,
      updated_at = excluded.updated_at
  `;
}

export async function saveResource(
  installationId: string,
  resourceType: string,
  logicalName: string,
  ghlId: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const sql = database();
  if (!sql) {
    return;
  }
  await ensureSchema();
  await sql`
    insert into ghl_resources (id, installation_id, resource_type, logical_name, ghl_id, metadata)
    values (${randomUUID()}, ${installationId}, ${resourceType}, ${logicalName}, ${ghlId}, ${sql.json(metadata as unknown as JsonValue)})
    on conflict (installation_id, resource_type, logical_name) do update set
      ghl_id = excluded.ghl_id,
      metadata = excluded.metadata,
      updated_at = now()
  `;
}

export async function recordAudit(
  installationId: string | null,
  eventType: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  const sql = database();
  if (!sql) {
    return;
  }
  await ensureSchema();
  await sql`
    insert into audit_events (installation_id, event_type, detail)
    values (${installationId}, ${eventType}, ${sql.json(detail as unknown as JsonValue)})
  `;
}
