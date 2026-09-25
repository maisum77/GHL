export const databaseSchema = `
create table if not exists installations (
  id text primary key,
  location_id text not null unique,
  location_name text not null default '',
  company_id text,
  encrypted_token text not null,
  token_fingerprint text not null,
  form_url text not null default '',
  booking_url text not null default '',
  status text not null default 'connected',
  manifest jsonb not null default '{}'::jsonb,
  field_reports jsonb not null default '[]'::jsonb,
  warnings jsonb not null default '[]'::jsonb,
  manual_steps jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists ghl_resources (
  id text primary key,
  installation_id text not null references installations(id) on delete cascade,
  resource_type text not null,
  logical_name text not null,
  ghl_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (installation_id, resource_type, logical_name)
);

create table if not exists audit_events (
  id bigserial primary key,
  installation_id text references installations(id) on delete set null,
  event_type text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
`;
