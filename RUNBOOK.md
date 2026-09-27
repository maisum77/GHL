# Runbook — Every Manual Step

The complete ordered list of what you do by hand, in the order that works. Tick as you go.

**Total time: roughly 2–2.5 hours**, most of it waiting on a Vercel build.

| Phase | What | Time | Gate |
|---|---|---:|---|
| 0 | Gather credentials and decide on hosting | 15 min | — |
| 1 | Get it running locally | 5 min | Local site loads |
| 2 | Connect to GHL for the first time | 5 min | Setup returns a result panel |
| 3 | Confirm the field options stuck | 3 min | **No `options needed` lines** |
| 4 | Verify the connection read-only | 3 min | `verify:ghl --dry-run` passes |
| 5 | Build the pipeline and the nurture workflow | 10 min | Pipeline + workflow published |
| 6 | Connect the calendar host | 5 min | Slots appear |
| 7 | Verify email sending — only if you added email steps | 5 min | Test email arrives |
| 8 | Re-connect with all IDs | 3 min | No outstanding manual steps |
| 9 | Test all three lead paths | 15 min | HOT/WARM/NURTURE all correct |
| 10 | Full write verification | 3 min | `verify:ghl` passes |
| 11 | Deploy to production | 20 min | Live site loads |
| 12 | Go-live acceptance test | 30 min | `HANDOVER.md` §9 complete |
| 13 | After handover decisions | 5 min | — |

> **Do not skip Phase 3.** It is a ten-second read, not a repair job. If the app reports
> `options needed`, leads will score 0 on that field and always classify as `NURTURE` while
> everything looks healthy. Everything downstream — scoring, workflow branches, the dashboard —
> reads the fields Phase 3 protects.

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
| Custom fields — read & write | The 12 qualification fields |
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

**Expected:** a result panel listing created fields, tags, and the `Discovery Call` calendar.
Status will say **Action needed** — that is correct at this stage.

- [ ] Location name shown is your intended subaccount
- [ ] 12 fields reported
- [ ] 4 tags reported
- [ ] `calendar:Discovery Call` created
- [ ] One manual step mentions creating the `Agency Funnel` pipeline — **expected**, see Phase 5

> **If you see warnings** like `Could not read workflows (401)`, your token is missing a scope. Go
> back to 0.1 and add it. Each warning names the exact resource.

---

## Phase 3 — Confirm the field options stuck

GHL silently discards a dropdown value that is not one of the field's real options, which can make
a lead score `NURTURE` with an empty budget while every screen looks healthy. The app creates the
options itself and reads each one back, so this phase is a **check, not a repair job**.

- [ ] **No field says `options needed`** → skip to Phase 4
- [ ] **One or more do** → the option payload was rejected. Re-run setup first; if it persists,
      add the options by hand:

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

**`Existing Website`** — 2 options (`Yes`, `No`). It is a checkbox, which GHL treats as a
multi-select, so it is rejected outright without them.

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
- [ ] Step 2 passes — all 12 fields exist
- [ ] **Step 3 passes — all four picklists report every option present**
- [ ] Step 4 passes — 4 tags
- [ ] Step 5 passes — pipeline with 8 stages (needs Phase 5.1 first)
- [ ] Step 10 passes — finds `Lead Nurture` *(will fail until Phase 5 — that is fine)*

If step 3 fails, return to 3.2. If any other step fails, the message names what to fix.

---

## Phase 5 — Build the pipeline and the nurture workflow

Neither can be created by API. GHL rejects `POST /opportunities/pipelines` with
`401 The token is not authorized for this scope` even when Opportunities read & write is granted —
the same token creates opportunities at `POST /opportunities/` without complaint. Workflows are
read-only over the API entirely. Both are found **by name** on the next setup run, so there is no
ID to paste for the pipeline.

### 5.1 The `Agency Funnel` pipeline

GHL → **Opportunities → Pipelines → Create**. Name it exactly `Agency Funnel`, with these eight
stages in this order. The app looks stages up by name, so a rename breaks opportunity creation.

```
New Lead · Qualified · Call Booked · Discovery Completed
Proposal Sent · Negotiation · Won · Lost
```

- [ ] Pipeline created with all 8 stage names spelled exactly as above
- [ ] Opened once in the UI so GHL registers it

### 5.2 The `Lead Nurture` workflow

Open **`NURTURE_WORKFLOW.md`** and follow it. Build **Variant A** — §1B is the shortest route:

- [ ] Create a workflow named exactly `Lead Nurture`
- [ ] Trigger: `Contact Tag` = `hot` (the app already applies that tag to hot leads)
- [ ] **Internal Notification** to yourself, immediate, no wait before it
- [ ] Notification body uses dynamic values for `Budget`, `Timeline`, `Lead Score`
- [ ] `Add Tag: Qualified`
- [ ] Stop conditions set — stop on `Call Booked`, on the `Qualified` tag, and on Do Not Contact
- [ ] **Publish** the workflow (the app only enrols into published workflows)
- [ ] Copy the workflow ID (GHL → Settings → Workflows, or the workflow's URL)
- [ ] In `/setup`, set "How does the workflow start?" to **Contact tag triggers it**

If you would rather the workflow see every lead and branch internally, follow §1A instead and
leave the wizard on **Enrol every lead**. The two are mutually exclusive: pick both and every hot
lead is notified twice.

> **No sending domain yet?** That is fine, and Variant A is built for it. An Internal
> Notification goes to your own GHL inbox and needs no verified sender, so a HOT lead still
> alerts you the moment it lands. The six nurture emails in §3–§5 of the guide are an additive
> upgrade once you have a domain — you insert steps into this same workflow, you do not rebuild
> it. See "Choose a variant first" in the guide.

> **Tag-trigger caveat.** A workflow started by a `Contact Tag` trigger can only ever reach
> contacts carrying that tag, so it will never see WARM or NURTURE leads. That is fine for
> Variant A, which does nothing for them. Before adding the nurture drip in Variant B, switch the
> trigger to a real event, set the wizard back to **Enrol every lead**, and add the §2 branch —
> all in one sitting, or non-hot leads will silently receive nothing.

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

**Skip this phase if you built the workflow as Variant A** (notifications only, no email steps).
It is the one phase that can be deferred: with no `Send Email` action in the workflow there is
nothing to fail, and the funnel is complete without it.

If you did add the nurture emails, they silently fail if the sender is not verified.

- [ ] GHL → **Settings → Domains** — confirm the sending domain shows **verified**
- [ ] Send a test email to yourself from the `Lead Nurture` workflow
- [ ] Confirm it arrives and is not in spam

---

## Phase 8 — Re-connect with everything

Return to `/setup` and submit again with the same token, now filling in:

- [ ] **Nurture workflow ID** — from Phase 5
- [ ] **How does the workflow start?** — "Contact tag triggers it" for §1B, "Enrol every lead" for §1A
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
| `Could not read calendars` / `Could not create the discovery calendar` | Calendars — read / write |
| `Could not read workflows` | Workflows — read |
| `Could not read forms` | Forms — read |
| `Could not read users` | Users — read |
| `Could not read pipelines` | Opportunities — read |
| Setup returns `Forbidden` on every call | You used a legacy API key, not a Private Integration |

> `Could not create pipeline` is **not** a scope problem. GHL refuses pipeline administration to
> Private Integration tokens whatever scopes are ticked — build the pipeline in the UI (Phase 5.1).

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
