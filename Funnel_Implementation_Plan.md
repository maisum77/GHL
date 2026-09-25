# Digital Agency Lead-to-Call Funnel — GHL Handover Implementation

> **Status: ACTIVE · GHL-native · Vercel control plane · one connected location**
>
> The project is now built around a client-owned GoHighLevel subaccount. The Vercel application owns the public website, the protected setup wizard, the GHL API adapter, and setup metadata. GHL remains the source of truth for contacts, opportunities, appointments, forms, workflows, and email.

## 1. Goal

Deliver a lead-to-call system that can be handed to a client with one GHL location connected through a scoped Private Integration token.

The client should be able to:

1. Open the protected setup route.
2. Enter the setup access code, GHL Private Integration token, and Location ID.
3. Validate the location.
4. Let the application discover existing resources and create only safe, missing resources.
5. Complete one short GHL-side setup for form/workflow assets that the public API cannot create.
6. Paste the form and calendar URLs into the wizard.
7. Submit a real test lead and booking before going live.

## 2. Runtime Architecture

```text
Visitor
  ↓
Vercel Next.js landing page
  ↓
Qualification form (local, or GHL form embed when configured)
  ↓
POST /api/leads — scoring, routing, and provisioning all happen here
  ├── upsert GHL Contact with the 13 qualification fields
  ├── apply the HOT / WARM / NURTURE tag
  ├── create an Opportunity (HOT → Qualified, otherwise New Lead)
  └── enrol the contact in the Lead Nurture workflow
  ↓
GHL Calendar (booking)  →  Opportunity: Call Booked
  ↓
GHL Opportunity and appointments
```

The app owns the deterministic routing so the funnel works from a credential alone. GHL's workflow
API is read-only, so the nurture *sequence* is the one thing built in the GHL UI; the app enrols
every lead into it.

The Vercel database stores only setup state, encrypted credentials, GHL resource IDs, and audit
metadata. It does not become a second CRM and does not store lead submissions.

## 3. Application Surface

| Route | Purpose |
|---|---|
| `/` | Public agency landing page |
| `/apply` | GHL form embed when configured; local demo form during development |
| `/book` | GHL calendar embed when configured; setup state otherwise |
| `/dashboard` | Private read-only opportunity snapshot |
| `/setup` | Protected first-run connection and resource provisioning wizard |
| `/api/health` | Deployment health response |
| `/api/setup/connect` | Validates credentials and provisions safe GHL resources |
| `/api/setup/status` | Returns setup state to an authenticated session |
| `/api/leads` | Local fallback lead intake; upserts to GHL when connected |
| `/api/dashboard` | Authenticated GHL opportunity snapshot |

## 4. Handover Flow

### 4.1 Client prerequisites

The client must have:

- One active GHL subaccount/location.
- Permission to create a Private Integration.
- Permission to create forms, workflows, calendars, pipelines, custom fields, and tags.
- A connected meeting provider for the discovery calendar.
- A verified GHL/LC Email sender and sending domain.
- A permanent qualification form URL.
- A permanent discovery calendar booking URL.

### 4.2 Setup wizard

`/setup` requires the setup access code before accepting a GHL token. The token is submitted over TLS to a server route and is never placed in a URL, browser storage, response payload, or log.

The server then:

1. Calls the GHL location endpoint with `Version: v3`.
2. Confirms the returned location matches the supplied Location ID.
3. Discovers custom fields, tags, pipelines, forms, workflows, calendars, and users.
4. Creates missing contact fields, then **re-reads each one to verify its options persisted**.
5. Creates missing qualification tags.
6. Creates the `Agency Funnel` pipeline only when no suitable pipeline exists.
7. Creates the `Discovery Call` calendar with 30-minute slots when none exists.
8. Stores encrypted credentials and resource IDs.
9. Returns a non-secret setup result and the remaining manual GHL steps.

### 4.2.1 Picklist options require verification

GHL's location-scoped custom-field route accepts only `textBoxListOptions`, which applies to
`TEXTBOX_LIST`. For a `SINGLE_OPTIONS` field it returns a success response and discards the values.
The setup wizard therefore attempts the v3 `POST /custom-fields` route, which accepts `options`, and
then reads every field back. A field whose options did not persist is reported as
`created_missing_options` with the exact list to add, never as provisioned. `/api/leads` also filters
picklist values against the stored option list, so an unrecognised value is dropped with a warning
instead of risking a rejected upsert.

### 4.3 One-time GHL-side setup

GHL's public API cannot create workflow graphs, and a calendar has no real availability until a host
connects an external account. The client therefore completes three steps in GHL:

- Build and publish the `Lead Nurture` workflow from `NURTURE_WORKFLOW.md`, then paste its ID into
  the wizard. The app enrols every lead automatically.
- Connect Google or Outlook for the host of the `Discovery Call` calendar.
- Verify the email sender and sending domain.

Optionally import a qualification form and paste its URL, though the app's own form is the default.

The wizard keeps the installation in `awaiting_assets` until the URLs and the nurture workflow ID are
present. It reaches `ready` once nothing remains outstanding.

## 5. GHL Resource Manifest

The setup wizard provisions or discovers these resources:

### Contact custom fields

- Company
- Website
- Service
- Challenge
- Budget
- Timeline
- Existing Website
- Lead Score
- Lead Status
- UTM Source
- UTM Medium
- UTM Campaign
- Landing Page

### Tags

- HOT
- WARM
- NURTURE
- Qualified
- Nurture

### Pipeline

`Agency Funnel`

```text
New Lead → Qualified → Call Booked → Discovery Completed → Proposal Sent → Negotiation → Won → Lost
```

### Calendar

`Discovery Call` — personal calendar, 30-minute slots, 30-minute interval, 1 appointment per slot, 8
per day, booking window 30 days, reschedule and cancellation enabled, auto-confirm on. The app creates
it; the client connects the host's external calendar for real availability.

### Workflow

`Lead Nurture` — one workflow, built by the client from `NURTURE_WORKFLOW.md`. The app holds its ID
and enrols every lead. Gated on `Lead Status` so hot leads skip the drip.

## 6. Lead Scoring

The application keeps the original scoring rules as a deterministic fallback and as a reference for GHL workflow configuration.

| Condition | Points |
|---|---:|
| Budget `$3,000–$5,000` or `$5,000+` | +30 |
| Budget `$1,500–$3,000` | +20 |
| Budget `$500–$1,500` | +10 |
| Start immediately | +20 |
| Start within 30 days | +15 |
| Existing website | +10 |
| Specific challenge selected | +10 |

```text
70+   = HOT
40–69 = WARM
0–39  = NURTURE
```

The visitor never sees the score. The GHL workflow should use stable field IDs and option IDs rather than display labels.

## 7. Environment Contract

Copy `.env.example` to the deployment secret manager. Never commit real values.

| Variable | Required | Purpose |
|---|---:|---|
| `DATABASE_URL` | Production | Managed PostgreSQL connection string |
| `SETUP_ACCESS_CODE` | Production | Protects the setup route |
| `SESSION_SECRET` | Production | Signs the HttpOnly setup session |
| `CREDENTIAL_ENCRYPTION_KEY` | Production | Encrypts the GHL token at rest |
| `GHL_API_BASE_URL` | No | Defaults to the GHL API host |
| `GHL_API_VERSION` | No | Defaults to `v3` |
| `NEXT_PUBLIC_SITE_URL` | Production | Canonical site URL |
| `GHL_FORM_URL` | No | Optional form URL before setup state exists |
| `GHL_BOOKING_URL` | No | Optional booking URL before setup state exists |

For local development, the app uses a process-memory setup store and accepts an empty setup access code. Production refuses to save setup state without the required secrets and database.

## 8. Security Model

- Use a location-scoped GHL Private Integration token, not a legacy API key.
- Request only the scopes needed for discovery, fields, tags, pipelines, calendars, forms, workflows, users, and contacts.
- Encrypt tokens with AES-256-GCM and associated data containing the Location ID.
- Store only a short token fingerprint for audit purposes.
- Use an HttpOnly, Secure, SameSite session cookie for setup/dashboard access.
- Do not log authorization headers, request bodies, contact data, or raw GHL errors.
- Do not use the setup route for analytics or third-party scripts.
- Keep the public landing page separate from the private setup surface.
- Rotate or revoke the GHL token after handover if the native GHL runtime no longer needs API access.
- Use separate production and preview databases.
- Use a production-appropriate Vercel plan for a commercial client deployment.

## 9. Database Tables

The application creates these tables on first write:

- `installations` — location binding, encrypted token, URLs, status, manifest, warnings, and manual steps.
- `ghl_resources` — logical resource names mapped to GHL IDs.
- `audit_events` — non-secret setup actions and outcomes.

No table stores contact submissions, opportunity records, appointment payloads, or full lead data.

## 10. API Behavior

### `POST /api/setup/connect`

Expected body:

```json
{
  "accessCode": "handover-code",
  "token": "ghl-private-integration-token",
  "locationId": "location-id",
  "formUrl": "https://forms.example/...",
  "bookingUrl": "https://calendar.example/..."
}
```

The response contains status, location metadata, created resource names, warnings, and manual steps. It never contains the token or encrypted credential.

### `POST /api/leads`

The local fallback accepts the qualification fields, calculates a classification, and upserts the contact to the connected GHL location when setup exists. In production without setup, it returns `503` rather than silently losing a lead.

### `GET /api/dashboard`

Requires a valid setup session. Returns a small opportunity snapshot and does not return credentials.

## 11. Verification

### Automated checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

### Manual client acceptance test

1. Open `/setup` on the deployed HTTPS URL.
2. Submit an invalid setup code and confirm access is denied.
3. Submit the location-scoped token and Location ID.
4. Confirm the returned location name matches the intended subaccount.
5. Confirm the setup result lists only created resources and non-secret warnings.
6. Complete the one-time GHL form/workflow/calendar setup.
7. Paste the permanent form and booking URLs into the wizard.
8. Submit a HOT test lead.
9. Confirm the GHL contact has the expected custom fields and status.
10. Confirm the GHL opportunity is created or enrolled in the correct workflow.
11. Book a real test appointment.
12. Confirm the opportunity moves to `Call Booked`.
13. Test cancellation and rescheduling.
14. Submit the same email again and confirm duplicate handling is safe.
15. Verify the dashboard reflects the GHL opportunity snapshot.
16. Rotate or revoke the setup token if it is no longer needed.

## 12. Definition of Done

Automated checks and code-level requirements. Every box is verified in CI or by
`npm run verify:ghl`; none of them require trusting a manual step.

- [x] Lint, typecheck, tests, and production build pass.
- [x] No real credentials are committed to the repository.
- [x] The client can connect one GHL location through `/setup`.
- [x] The token is encrypted at rest and never returned to the browser.
- [x] Existing GHL resources are discovered without destructive updates.
- [x] Missing safe resources are provisioned idempotently.
- [x] Picklist options are verified by read-back rather than trusted from a 2xx.
- [x] Qualification form, booking page, and dashboard use the connected GHL resources.
- [x] Duplicate submissions resolve to the same GHL contact.
- [x] A submitted lead is tagged, pipelined at the mapped stage, and enrolled in nurture.
- [x] A secondary failure never discards a saved lead; it is reported and audited.
- [x] Production refuses to start without its secrets or with a weak encryption key.

Requires a real GHL subaccount. Run `npm run verify:ghl` and the checklist in `HANDOVER.md` §9.

- [ ] A fresh production deployment starts with only the documented environment secrets.
- [ ] Every qualification field reports provisioned options in a real location.
- [ ] The client completes the one-time GHL setup: nurture workflow, calendar host, email sender.
- [ ] HOT, WARM, and NURTURE paths are verified against the live nurture workflow.
- [ ] Appointment booking moves the opportunity to `Call Booked`.
- [ ] Nurture email delivery is confirmed from the verified sender domain.

The older free-stack revision is retained only as historical context. This document and the implemented application define the active handover direction.
