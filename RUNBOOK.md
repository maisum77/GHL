# Runbook — Every Manual Step

The complete ordered list of what you do by hand, in the order that works. Tick as you go.

**Total time: roughly 2–2.5 hours**, most of it waiting on a Vercel build.

| Phase | What | Time | Gate |
|---|---|---:|---|
| 0 | Gather credentials and decide on hosting | 15 min | — |
| 1 | Get it running locally | 5 min | Local site loads |
| 2 | Connect to GHL for the first time | 5 min | Setup returns a result panel |
| 3 | Fix any field that lost its options | 10 min | **No `options needed` lines** |
| 4 | Verify the connection read-only | 3 min | `verify:ghl --dry-run` passes |
| 5 | Build the nurture workflow | 20 min | Workflow published |
| 6 | Connect the calendar host | 5 min | Slots appear |
| 7 | Verify email sending | 5 min | Test email arrives |
| 8 | Re-connect with all IDs | 3 min | No outstanding manual steps |
| 9 | Test all three lead paths | 15 min | HOT/WARM/NURTURE all correct |
| 10 | Full write verification | 3 min | `verify:ghl` passes |
| 11 | Deploy to production | 20 min | Live site loads |
| 12 | Go-live acceptance test | 30 min | `HANDOVER.md` §9 complete |
| 13 | After handover decisions | 5 min | — |

> **Do not skip Phase 3.** It is the one step where the system can look completely healthy while
> silently dropping your data. Everything downstream — scoring, workflow branches, the dashboard —
> reads the fields that Phase 3 protects.

---

## Phase 0 — Prepare

### 0.1 Create the Private Integration token

GHL → **Settings → Private Integrations → Create**

- Name it something recognisable, e.g. `Website Funnel`
- Select these scopes:

| Scope | Needed for |
|---|---|
| Contacts — read & write | Upserting leads, reading them back |
| Opportunities — read & write | Pipeline, opportunities, dashboard |
| Calendars — read & write | The `Discovery Call` calendar |
| Locations — read | Validating the location ID |
| Custom fields — read & write | The 13 qualification fields |
| Tags — read & write | HOT / WARM / NURTURE |
| Workflows — read | Finding your nurture workflow |
| Forms — read | Form discovery |
| Users — read | Picking the calendar host |

- Copy the token. **It is shown once.**

> Use a Private Integration token. A legacy API key will not work and setup will return `Forbidden`.

### 0.2 Note the Location ID

GHL → **Settings → Business Profile**. Copy the Location ID.

### 0.3 Generate your secrets

```bash
openssl rand -hex 32      # CREDENTIAL_ENCRYPTION_KEY
openssl rand -base64 32   # SESSION_SECRET
openssl rand -base64 12   # SETUP_ACCESS_CODE
```

Save all three somewhere you will not lose them. Store them in a password manager.

> **Losing `CREDENTIAL_ENCRYPTION_KEY` means re-entering the GHL token through the setup wizard.**
> It is the only thing encrypting your credential at rest.

### 0.4 Provision a database

Only needed for production. Any managed Postgres works — Vercel Postgres, Neon, Supabase. Copy the
connection string.

The app creates its own three tables on first write, so the role needs DDL rights.

---

## Phase 1 — Run locally

Nothing here needs credentials or env vars. Development mode uses an in-process store and accepts
any setup access code.

```bash
npm install
npm run dev
```

- [ ] `http://localhost:3000` loads
- [ ] `http://localhost:3000/apply` loads
- [ ] `http://localhost:3000/api/health` returns `"ok": true`

---

## Phase 2 — First connection

Open `http://localhost:3000/setup`.

- [ ] **Setup access code** — type anything (local mode skips the check)
- [ ] **GHL Private Integration token** — paste yours
- [ ] **GHL Location ID** — paste yours
- [ ] Leave form URL, booking URL, workflow ID, and host user ID empty
- [ ] Submit

**Expected:** a result panel listing created fields, tags, the pipeline, and the `Discovery Call`
calendar. Status will say **Action needed** — that is correct at this stage.

- [ ] Location name shown is your intended subaccount
- [ ] 13 fields reported
- [ ] 5 tags reported
- [ ] `pipeline:Agency Funnel` created
- [ ] `calendar:Discovery Call` created

> **If you see warnings** like `Could not read workflows (401)`, your token is missing a scope. Go
> back to 0.1 and add it. Each warning names the exact resource.

---

## Phase 3 — Fix the field options

**This phase is the important one.**

GHL will not store a dropdown value that is not one of the field's real options. For
`SINGLE_OPTIONS` fields, GHL's create endpoint can return success while discarding the values
entirely. The app reads every field back to detect this and reports:

> `Created, options needed`

### 3.1 Check the result panel

- [ ] **No field says `options needed`** → skip to Phase 4
- [ ] **One or more do** → continue

### 3.2 Add the options in GHL

GHL → **Settings → Custom Fields → Contact** → click the field → **Edit** → **Options**

Add exactly the values below. The wizard also lists the specific missing ones for each field.

**`Service`** — 7 options, in this order:

```
Website Development
Landing Page
SaaS / Web Application
AI Automation
CRM / Funnel
E-commerce
Other
```

**`Budget`** — 5 options. Note the en dashes, they must match exactly:

```
Under $500
$500–$1,500
$1,500–$3,000
$3,000–$5,000
$5,000+
```

**`Timeline`** — 4 options:

```
Immediately
Within 30 days
1–3 months
Just researching
```

**`Lead Status`** — 3 options:

```
HOT
WARM
NURTURE
```

> Copy-paste carefully. A mismatched character — a hyphen instead of an en dash in `Budget` — means
> leads will score 0 on that field and always classify as `NURTURE`.

### 3.3 Re-run setup

- [ ] Submit `/setup` again with the same token
- [ ] No field reports `options needed`
- [ ] Status is still **Action needed** (expected until Phase 8)

---

## Phase 4 — Verify read-only

```bash
GHL_TOKEN=<your-token> GHL_LOCATION_ID=<your-location-id> npm run verify:ghl -- --dry-run
```

- [ ] Step 1 passes — location resolves
- [ ] Step 2 passes — all 13 fields exist
- [ ] **Step 3 passes — all four picklists report every option present**
- [ ] Step 4 passes — 5 tags
- [ ] Step 5 passes — pipeline with 8 stages
- [ ] Step 10 passes — finds `Lead Nurture` *(will fail until Phase 5 — that is fine)*

If step 3 fails, return to 3.2. If any other step fails, the message names what to fix.

---

## Phase 5 — Build the nurture workflow

GHL's workflow API is read-only, so this is the one thing you must build by hand. The app enrols
every lead into it, so there is nothing to wire up afterwards.

Open **`NURTURE_WORKFLOW.md`** and follow it. Summary:

- [ ] Create a workflow named exactly `Lead Nurture`
- [ ] First step is an If/Else on `Lead Status` = `HOT`
- [ ] HOT branch: booking CTA email → wait 1 day → nudge → wait 3 days → notify
- [ ] Nurture branch: 6 emails over 14 days, per the guide
- [ ] Exit conditions set — stop on `Call Booked` and on the `Qualified` tag
- [ ] Every email contains the booking link
- [ ] **Publish** the workflow

- [ ] Copy the workflow ID (GHL → Settings → Workflows, or the workflow's URL)

> All three classifications get enrolled — the app enrols everyone. The workflow's internal If/Else
> decides that `HOT` leads skip the drip and get the booking CTA instead.

---

## Phase 6 — Connect the calendar host

The app created the calendar, but it has **no availability** until a host connects a real one.

GHL → **Settings → Calendars** → **Discovery Call** → **Edit**

- [ ] **Connections** — connect Google Calendar or Outlook for the chosen host
- [ ] Confirm working hours and booking buffers suit you
- [ ] Confirm the public booking page now shows real slots

- [ ] Copy the public booking URL from the calendar's booking/embed tab

> Typical shape: `https://msgsndr.com/calendar/<slug>` or a `calendar.gohighlevel.com` link.

---

## Phase 7 — Verify email sending

Nurture emails silently fail if the sender is not verified.

- [ ] GHL → **Settings → Domains** — confirm the sending domain shows **verified**
- [ ] Send a test email to yourself from the `Lead Nurture` workflow
- [ ] Confirm it arrives and is not in spam

---

## Phase 8 — Re-connect with everything

Return to `/setup` and submit again with the same token, now filling in:

- [ ] **Nurture workflow ID** — from Phase 5
- [ ] **Booking URL** — from Phase 6
- [ ] **Calendar host user ID** — optional; skip unless the default host is wrong
- [ ] **Form URL** — optional. `/apply` uses the app's own form, which is what scores and routes
      the lead. Only add this if you want submissions to appear directly in the GHL forms UI

**Expected:** the manual steps list is now empty, or nearly so, and status reads **Ready**.

---

## Phase 9 — Test all three lead paths

Submit one lead for each classification from `http://localhost:3000/apply`. Use a real inbox you
control, and a different email each time.

### 9.1 HOT — expect score 70

| Field | Value | Points |
|---|---|---:|
| Budget | `$5,000+` | 30 |
| Timeline | `Immediately` | 20 |
| Already have a website | Yes | 10 |
| Biggest challenge | anything except `Other` | 10 |

- [ ] Response says `classification: HOT`, `score: 70`
- [ ] Contact has `Budget` = `$5,000+` — **not blank**
- [ ] Contact has `Timeline` = `Immediately`, `Lead Status` = `HOT`
- [ ] Contact carries the `HOT` tag
- [ ] Opportunity exists in `Agency Funnel` at stage **`Qualified`**
- [ ] Contact is enrolled in `Lead Nurture`
- [ ] Receives the HOT booking CTA, not nurture touch 1

### 9.2 WARM — expect score 45

| Field | Value | Points |
|---|---|---:|
| Budget | `$1,500–$3,000` | 20 |
| Timeline | `Within 30 days` | 15 |
| Already have a website | Yes | 10 |
| Biggest challenge | `Other` | 0 |

- [ ] `classification: WARM`, `score: 45`
- [ ] Tag `WARM`, opportunity at stage **`New Lead`**
- [ ] Receives nurture touch 1

### 9.3 NURTURE — expect score 0

| Field | Value | Points |
|---|---|---:|
| Budget | `Under $500` | 0 |
| Timeline | `Just researching` | 0 |
| Already have a website | No | 0 |
| Biggest challenge | `Other` | 0 |

- [ ] `classification: NURTURE`, `score: 0`
- [ ] Tag `NURTURE`, opportunity at stage **`New Lead`**
- [ ] Receives nurture touch 1

### 9.4 Dashboard and booking

- [ ] `http://localhost:3000/dashboard` shows all three opportunities
- [ ] `http://localhost:3000/book` shows the live calendar with real slots
- [ ] Book a test appointment
- [ ] The opportunity moves to **`Call Booked`**
- [ ] Reschedule and cancel both work
- [ ] Re-submit the 9.1 email — no duplicate contact, no second opportunity

> **A blank `Budget` on any of these means Phase 3 did not hold.** Go back to 3.2. This is the
> single most common way to think everything works when it does not.

---

## Phase 10 — Full write verification

```bash
GHL_TOKEN=<your-token> GHL_LOCATION_ID=<your-location-id> npm run verify:ghl
```

This creates one synthetic lead and walks the whole chain, then re-reads the contact to confirm the
values persisted.

- [ ] Every step reports PASS
- [ ] Summary reads `All checks passed`
- [ ] Delete the `funnel-verify-*@example.com` contact from GHL when done

---

## Phase 11 — Deploy to production

- [ ] Push to GitHub
- [ ] Import into Vercel
- [ ] Set these environment variables:

| Variable | Value |
|---|---|
| `DATABASE_URL` | From 0.4 |
| `SETUP_ACCESS_CODE` | From 0.3 |
| `SESSION_SECRET` | From 0.3 |
| `CREDENTIAL_ENCRYPTION_KEY` | From 0.3 — the 64-hex one, not the base64 one |
| `NEXT_PUBLIC_SITE_URL` | `https://your-domain.com` |

- [ ] Leave `GHL_API_BASE_URL` and `GHL_API_VERSION` unset unless you have a reason not to
- [ ] Deploy and confirm the live site loads
- [ ] Run `/setup` on the production domain with the same token
- [ ] Confirm it reaches **Ready**

> The database is separate from local development, so production starts with no setup state. You must
> run `/setup` again after deploying. This is expected.

---

## Phase 12 — Go-live acceptance test

Work through **`HANDOVER.md` §9** — 19 checkboxes covering the full funnel on the live domain. The
one people skip is step 9 (confirm `Budget` is not blank). Do not skip it.

---

## Phase 13 — After handover

Decide whether to keep the token live:

- [ ] **Keep it** — the funnel keeps working unattended. This is the normal choice.
- [ ] **Revoke it** only if the GHL form does the lead capture instead of the app's own form. The
      dashboard and setup stop working; leads degrade to a local demo.

- [ ] Archive `CREDENTIAL_ENCRYPTION_KEY`, `SESSION_SECRET`, and `SETUP_ACCESS_CODE` in a password
      manager
- [ ] Delete the three test leads, or tag them `Test` so they are excluded from reporting
- [ ] If the token ever leaks: create a new Private Integration, paste it into `/setup`, then delete
      the old one

---

## Appendix A — Which scope is missing?

Setup warnings name the resource. Match them here:

| Warning contains | Missing scope |
|---|---|
| `Could not read custom fields` | Custom fields — read |
| `Could not create field` | Custom fields — write |
| `Could not read tags` / `Could not create tag` | Tags — read / write |
| `Could not read pipelines` / `Could not create pipeline` | Opportunities — read / write |
| `Could not read calendars` / `Could not create the discovery calendar` | Calendars — read / write |
| `Could not read workflows` | Workflows — read |
| `Could not read forms` | Forms — read |
| `Could not read users` | Users — read |
| Setup returns `Forbidden` on every call | You used a legacy API key, not a Private Integration |

## Appendix B — Scoring reference

| Budget | Points | | Timeline | Points |
|---|---:|---|---|---:|
| `$5,000+` | 30 | | `Immediately` | 20 |
| `$3,000–$5,000` | 30 | | `Within 30 days` | 15 |
| `$1,500–$3,000` | 20 | | `1–3 months` | 0 |
| `$500–$1,500` | 10 | | `Just researching` | 0 |
| `Under $500` | 0 | | | |

Plus 10 for already having a website, and 10 for a specific challenge (anything except `Other`).

```text
70+   = HOT      → opportunity opens at Qualified
40–69 = WARM     → opportunity opens at New Lead
0–39  = NURTURE  → opportunity opens at New Lead
```

## Appendix C — Stage names must match exactly

The app looks up pipeline stages by name. If you renamed a stage, opportunity creation is skipped
with a warning.

```text
New Lead · Qualified · Call Booked · Discovery Completed
Proposal Sent · Negotiation · Won · Lost
```

## Appendix D — Where to find things

| Thing | Location |
|---|---|
| Private Integration token | Settings → Private Integrations |
| Location ID | Settings → Business Profile |
| Custom fields and options | Settings → Custom Fields → Contact |
| Tags | Settings → Tags |
| Pipeline and stages | Opportunities → Pipelines |
| Calendar and connections | Settings → Calendars |
| Nurture workflow ID | Settings → Workflows |
| Email domain verification | Settings → Domains |
| Duplicate-contact setting | Settings → Duplicates |

## Appendix E — Rollback

If production is misbehaving and you need to stop taking leads:

1. Unset `bookingUrl` and `formUrl` by re-running setup with empty fields — the public pages fall
   back to a setup-state message instead of a live form.
2. Or revoke the GHL token. `/api/leads` returns `503` in production rather than silently losing a
   lead, so visitors see an error rather than a false success.
3. Your contacts, opportunities, tags, and pipeline in GHL are untouched by any of this. The app only
   ever creates and adds.
