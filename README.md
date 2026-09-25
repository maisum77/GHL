# GHL Lead-to-Call Funnel

A website funnel for a digital agency, wired into one GoHighLevel subaccount. Visitors land on a
page, submit a qualifying form, and end up as a scored, tagged contact sitting in a real opportunity
with a booking calendar in front of them.

The public site and the GHL integration are one deployment. Pasting a GHL Private Integration token
into `/setup` is the only configuration step — after that, every submission is scored, tagged,
pipelined, and enrolled in nurture automatically.

---

## Architecture

```text
Visitor
  ↓
Next.js landing page  →  /apply  (qualification form)
  ↓
POST /api/leads
  ├── score the lead (deterministic, src/lib/scoring.ts)
  ├── upsert contact to GHL with 12 custom fields
  ├── add the HOT / WARM / NURTURE tag
  ├── create an opportunity in Agency Funnel (HOT → Qualified, else New Lead)
  └── enrol the contact in the Lead Nurture workflow
  ↓
/book  (GHL Discovery Call calendar)
  ↓
/dashboard  (read-only opportunity snapshot)
```

GHL owns contacts, opportunities, appointments, and the nurture sequence. This app owns the public
site, the scoring, the provisioning, and the routing calls. Its database holds setup state, the
encrypted token, and resource IDs — never lead data.

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/apply` | Qualification form (GHL form embed if one is configured, otherwise the local form) |
| `/book` | Booking page |
| `/dashboard` | Private opportunity snapshot |
| `/setup` | First-run connection and provisioning wizard |
| `/api/health` | Deployment health |
| `/api/setup/connect` | Validates credentials, provisions resources, starts a session |
| `/api/setup/status` | Setup state for an authenticated session |
| `/api/leads` | Lead intake, scoring, and routing |

### What the app provisions on setup

12 contact custom fields (5 with verified options) and 4 routing tags, plus a 30-minute
`Discovery Call` calendar. Provisioning is idempotent and never deletes or rewrites an
existing resource.

### What has to be done in GHL

Three things, all documented: create the `Agency Funnel` pipeline, connect the calendar host, and
build the nurture workflow from [`NURTURE_WORKFLOW.md`](NURTURE_WORKFLOW.md). See
[`HANDOVER.md`](HANDOVER.md).

A verified **sending domain** is a fourth, and it is the only one that can be deferred. It is
needed for the nurture *emails* to reach cold leads, not for the funnel to work — the app never
sends email itself, it only enrols contacts. `NURTURE_WORKFLOW.md` Variant A runs on GHL's
Internal Notification, which needs no sender domain, so a HOT lead still alerts you the moment
it lands.

> **GHL does not let API tokens create pipelines or workflows.** A Private Integration with
> Opportunities read & write can create opportunities (`POST /opportunities/` → 201) but gets
> `401 The token is not authorized for this scope` on `POST /opportunities/pipelines`. The
> pipeline must be built in the UI. Name it `Agency Funnel` with the eight stage names in
> [`RUNBOOK.md`](RUNBOOK.md) Phase 5 and the next setup run detects it automatically — no
> ID to paste, and no code change.

---

## Local development

**Never done this before?** Start with **[`RUNBOOK.md`](RUNBOOK.md)** — the complete ordered
checklist from zero to a working funnel, with every option value spelled out.

```bash
npm install
cp .env.example .env.local   # optional: the app runs with no secrets in development
npm run dev
```

With no `DATABASE_URL`, setup state is held in process memory and `/api/leads` runs in demo mode,
returning the computed classification without calling GHL.

**Note:** the in-memory store lives on `globalThis`, so it resets when the dev server restarts and is
not shared between processes. It is a development convenience, not a store.

---

## Verifying a real credential

This is the check that matters before going live. It runs the same endpoint sequence as the app and
confirms the picklist options actually persisted — the failure GHL reports as success.

```bash
GHL_TOKEN=... GHL_LOCATION_ID=... npm run verify:ghl -- --dry-run   # read-only
GHL_TOKEN=... GHL_LOCATION_ID=... npm run verify:ghl                # exercises writes
```

---

## Environment

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Production | Postgres connection string |
| `SETUP_ACCESS_CODE` | Production | Protects `/setup` |
| `SESSION_SECRET` | Production | Signs the HttpOnly session cookie |
| `CREDENTIAL_ENCRYPTION_KEY` | Production | AES-256-GCM key for the GHL token. 64 hex chars or base64 → 32 bytes |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical site URL |
| `GHL_API_BASE_URL` | No | Defaults to `https://services.leadconnectorhq.com` |
| `GHL_API_VERSION` | No | Defaults to `v3` |
| `GHL_TOKEN` | Verify script only | Private Integration token |
| `GHL_LOCATION_ID` | Verify script only | Location ID |

Production refuses to start without all four required variables, and refuses a weak encryption key.

The app creates its tables (`installations`, `ghl_resources`, `audit_events`) on first write, so the
database role needs DDL rights. To manage them yourself, apply `src/lib/db-schema.ts` and grant only
DML.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit`, including tests |
| `npm test` | Vitest |
| `npm run verify:ghl` | Verify a real GHL credential |

---

## Security

- Location-scoped Private Integration token, never a legacy API key.
- Token encrypted at rest with AES-256-GCM, using the Location ID as associated data, so a
  credential cannot be moved between locations. Only a short fingerprint is kept for audit.
- HttpOnly, Secure, SameSite session cookie for setup and dashboard access.
- No authorization header, request body, contact data, or raw GHL error is logged. Every error
  crossing the network is passed through `redactSecrets`, which strips the token and caps length.
- The token is never returned to the browser, placed in a URL, or written to storage.
- Setup is throttled to 5 attempts per 15 minutes; lead intake to 8 per 10 minutes.

### Known limitations

- **Rate limiting is in-process.** The counters live on `globalThis`, so on Vercel they are
  per-instance and a determined attacker can bypass them by spreading requests. This stops casual
  abuse, not a targeted one. A shared store (Upstash, Vercel KV) would be needed to make it
  durable; `allowLeadSubmission` is the seam to swap.
- **Workflows and pipelines cannot be provisioned by API.** GHL's workflow API is read-only, and
  its pipeline endpoints reject Private Integration tokens outright, so both are built in the GHL
  UI. The app detects both by name and handles enrolment.
- **A calendar needs a connected host.** The app can create the calendar and its slot configuration,
  but real availability requires the host to connect Google or Outlook in GHL.
- **`/api/health` is unauthenticated** and reports whether a database and GHL are configured. It
  exposes no secrets, but it is not private.

---

## Layout

```text
src/app/            routes and API handlers
src/components/     client components
src/lib/
  config.ts         env contract and production assertions
  crypto.ts         AES-256-GCM, HMAC session signing
  db.ts             Postgres with an in-memory development fallback
  ghl.ts            the GHL API client
  rate-limit.ts     throttling and client identity
  redact.ts         secret stripping for outbound messages
  scoring.ts        lead scoring and stage mapping
  setup.ts          discovery and provisioning
  validation.ts     zod request schemas
scripts/            operational tooling
tests/              vitest suite
```
