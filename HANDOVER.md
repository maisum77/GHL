# Client Handover Runbook

Everything the funnel does automatically, and the things that must be done by hand.

> **Setting this up for the first time?** Use **[`RUNBOOK.md`](RUNBOOK.md)** instead — the
> linear, phase-by-phase checklist with every value spelled out. This document is the reference you
> come back to once it is live.

---

## 0. Current state

| | |
|---|---|
| Site | `https://moose-funnel-system.vercel.app` — deployed from `main`, auto-deploys on push |
| Location | `rafters` |
| Setup status | **ready** — 0 warnings, 0 manual steps |
| Verified | `npm run verify:ghl` reports **All checks passed** (12 steps) |
| Calendar | `Discovery Call`, Mon–Fri 09:00–17:00 Asia/Karachi, Google Meet links, 224 slots / 14 weekdays |
| Pipeline | `Agency Funnel`, 8 stages, currently empty |

**Two things are still outstanding:**

1. **The booking→pipeline workflow (§6.3).** Until it is built, a booked call leaves its
   opportunity at `Qualified` and the `Call Booked` stage never fills.
2. **`Settings → Duplicates` → allow on email only.** With the default, GHL's upsert merges on
   *any* identifier, so two leads sharing a phone number collapse into one contact and the second
   overwrites the first — silently, with no duplicate created. Verified against the live API.

A verified sending domain is **not** required for the funnel to work. The app never sends email;
it only enrols contacts, and the workflow's Internal Notification reaches your GHL inbox without
one. The domain is needed only for the six-touch nurture drip in `NURTURE_WORKFLOW.md` §4.

---

## What you get

| Piece | Who builds it |
|---|---|
| Landing page, qualification form, booking page, dashboard | The app — deployed |
| 12 contact qualification fields (with options) | The app — on setup |
| 4 routing tags (HOT / WARM / NURTURE / Qualified) | The app — on setup |
| `Discovery Call` calendar, 30-minute slots | The app — on setup |
| Contact creation, scoring, tagging, opportunity, nurture enrolment | The app — on every lead |
| `Agency Funnel` pipeline, 8 stages | **You** — GHL's API refuses pipeline writes *(done)* |
| ~~Calendar host connection~~ **You** — *done: Google Calendar, Mon–Fri 09:00–17:00 PKT* |
| **`Lead Nurture` workflow** | **You** — from `NURTURE_WORKFLOW.md` |
| **Verified email sender** | **You** — *deferrable; needed only for the nurture emails* |
| **Form and booking URLs** | **You** — copied from GHL |

> GHL lowercases every tag it stores, so `NURTURE` and `Nurture` are one tag. There are four
> routing tags, not five.

---

## 1. Before you start

You need:

- One active GHL subaccount, and permission to create a Private Integration.
- A GHL user who will host the discovery calls.
- A verified sending domain in GHL (LC Email or Google Workspace).
- Node 20.9+ if you are running the verification script locally.

Create a **Private Integration token** in GHL under Settings → Private Integrations → Create. Use a
Private Integration token, not a legacy API key. Copy the **Location ID** from Settings → Business Profile.

---

## 2. Deploy and configure

Deploy to Vercel, then set these environment variables:

| Variable | Required | Notes |
|---|---:|---|
| `DATABASE_URL` | Yes | Managed Postgres. The app creates its three tables on first write, so the role needs DDL rights. |
| `SETUP_ACCESS_CODE` | Yes | Protects `/setup`. Give it to the client, not the public. |
| `SESSION_SECRET` | Yes | Any long random string. |
| `CREDENTIAL_ENCRYPTION_KEY` | Yes | Exactly 32 bytes. Generate with `openssl rand -hex 32`. The app refuses to start without it. |
| `NEXT_PUBLIC_SITE_URL` | Yes | Your production domain. |
| `GHL_API_BASE_URL` | No | Defaults to the live GHL host. |
| `GHL_API_VERSION` | No | Defaults to `v3`. |

`CREDENTIAL_ENCRYPTION_KEY` encrypts the GHL token at rest with AES-256-GCM. **Losing it means
re-entering the token through the setup wizard.** Store it in the platform's secret manager, never
in the repository.

---

## 3. Prove the credential works

Before touching anything in the GHL UI, check the API side. This is the step that catches the
failure mode where GHL silently drops dropdown options:

```bash
GHL_TOKEN=your-private-token GHL_LOCATION_ID=your-location-id npm run verify:ghl -- --dry-run
```

`--dry-run` only reads. It confirms the location, all 12 fields, **the options on the 5 picklist
fields**, the 4 tags, and the pipeline stages.

Fix anything it reports, then run the full pass to exercise the write path:

```bash
GHL_TOKEN=your-private-token GHL_LOCATION_ID=your-location-id npm run verify:ghl
```

This creates one synthetic lead tagged `HOT`, opens an opportunity at `Qualified`, enrols it in
`Lead Nurture`, and then **re-reads the contact to confirm the picklist values actually persisted**.
Delete the `funnel-verify-*@example.com` contact when it passes.

---

## 4. Connect the funnel

Open `https://your-domain.com/setup` and enter:

1. **Setup access code** — the `SETUP_ACCESS_CODE` value.
2. **GHL Private Integration token**.
3. **GHL Location ID**.

Setup then creates the fields, tags, pipeline, and calendar. It reports one line per field:

- `Created` — good.
- `Created, options needed` — **fix this in GHL before going live.** See §5.
- `Already existed` — fine, unless it lists missing options.
- `Failed` — check the warning below it.

It stays `Action needed` until the remaining manual work is done, which is correct.

---

## 5. Fix any field reported as needing options

GHL will not store a picklist value that is not one of the field's real options, and the create API
returns success even when it discards them. So a lead can be scored `NURTURE` while its budget is
empty, and the workflow will branch wrongly.

In GHL: **Settings → Custom Fields → Contact → `<field name>` → Edit → Options.** Add exactly the
options the wizard listed, then re-run setup. It will report `Created` or `Already existed` with no
outstanding options.

The five fields that need them, with their required options:

| Field | Options |
|---|---|
| `Service` | Website Development · Landing Page · SaaS / Web Application · AI Automation · CRM / Funnel · E-commerce · Other |
| `Budget` | Under $500 · $500–$1,500 · $1,500–$3,000 · $3,000–$5,000 · $5,000+ |
| `Timeline` | Immediately · Within 30 days · 1–3 months · Just researching |
| `Lead Status` | HOT · WARM · NURTURE |
| `Existing Website` | Yes · No |

---

## 6. Build the pipeline and the nurture workflow

### 6.1 The `Agency Funnel` pipeline

GHL → **Opportunities → Pipelines → Create**, named exactly `Agency Funnel`, with these eight
stages in this order:

```
New Lead · Qualified · Call Booked · Discovery Completed
Proposal Sent · Negotiation · Won · Lost
```

The app finds the pipeline by name on its next run, so there is no ID to paste. Stage names must
match exactly — the app looks them up by name when placing an opportunity.

> This is not a permissions problem. A Private Integration with Opportunities read & write can
> create opportunities but receives `401 The token is not authorized for this scope` on
> `POST /opportunities/pipelines`. GHL does not expose pipeline administration to API tokens.

### 6.2 The `Lead Nurture` workflow

Follow **[NURTURE_WORKFLOW.md](NURTURE_WORKFLOW.md)**. Roughly 15 minutes: one HOT branch and a
six-touch nurture sequence. The app enrols every lead into it automatically, so there is nothing to
wire up afterwards beyond pasting the workflow ID into the setup wizard.

### 6.3 Move the opportunity when a call is booked

**Required. Five minutes. Without it the pipeline never shows a booked call.**

The app creates one opportunity per form submission, opening at `Qualified` for hot leads and
`New Lead` for everything else. Nothing then moves it when the lead books, so every booked
discovery call is left sitting at `Qualified` and the `Call Booked` stage stays empty. The
dashboard and any stage-based forecasting will both under-report.

```
Trigger   Appointment Status  →  booked
          Calendar             →  Discovery Call
Action    Move Opportunity
          Pipeline             →  Agency Funnel
          Stage                →  Call Booked
```

Publish it. It needs no email domain and no scopes beyond the ones already granted.

Note that a visitor who books from `/book` **without** submitting the form gets no opportunity
at all — the two paths are independent. That is deliberate, so junk bookings do not clutter the
pipeline, but it means pipeline coverage equals form submissions, not bookings.

---

## 7. Connect the calendar host

The `Discovery Call` calendar exists, but it has **no real availability** until a host connects an
external calendar.

In GHL: **Settings → Calendars → Discovery Call → Edit → Connections**, then connect Google or
Outlook for the chosen host. Confirm slots appear on the public booking page. Set working hours,
booking window, and buffers to taste.

**Meeting location.** Set it in the same editor, or booked calls go out with no way to join. GHL
only accepts three values for this field, and the names are not guessable — `zoom`, `google Meet`
and `phone` are all rejected as invalid enum values:

| Setting in the GHL UI | Value the API stores |
|---|---|
| Custom | `custom` |
| Google Meet | `google_conference` |
| In person / physical | `physical` |

---

## 8. Copy the two URLs

- **Form URL** — optional. `/apply` uses the app's own form, which is what scores and routes the
  lead. Use a GHL form only if you want the submission to appear in the GHL forms UI directly.
- **Booking URL** — required. Open the `Discovery Call` calendar and copy its public booking URL.

The booking URL looks like `https://msgsndr.com/widget/bookings/<slug>`. Note the path is
`/widget/bookings/`, **not** `/calendar/` — guessing the slug under the wrong path returns 404
and looks like the calendar is missing. GHL's API exposes no booking slug at all, so this value
exists only in the calendar editor.

Paste the booking URL into `/setup` and submit. `status` should read **ready** with zero manual
steps.

---

## 9. Acceptance test

Run through this once, on the live domain. Steps 1–13 are the original acceptance list; 14–17 cover
the automated routing.

- [ ] 1. `/setup` loads over HTTPS.
- [ ] 2. An invalid setup code is rejected.
- [ ] 3. A valid token and Location ID connect.
- [ ] 4. The returned location name is the intended subaccount.
- [ ] 5. The result lists only created resources and non-secret warnings.
- [ ] 6. Every field reports `Created` or `Already existed` with no missing options.
- [ ] 7. Form and booking URLs are saved.
- [ ] 8. Submit a HOT lead — budget `$5,000+`, timeline `Immediately`.
- [ ] 9. The GHL contact has all the custom fields, and `Budget` reads `$5,000+`, not blank.
- [ ] 10. The contact carries the `HOT` tag.
- [ ] 11. An opportunity exists in `Agency Funnel` at stage `Qualified`, named for the lead.
- [ ] 12. The contact is enrolled in `Lead Nurture`.
- [ ] 13. The dashboard shows the new opportunity.
- [ ] 14. Book a real test appointment from `/book`.
- [ ] 15. The opportunity moves to `Call Booked` (via the calendar in GHL).
- [ ] 16. Reschedule and cancel both work.
- [ ] 17. Submit the same email again — no duplicate contact, no second opportunity.
- [ ] 18. A NURTURE lead opens at `New Lead` instead, and receives touch 1.
- [ ] 19. Reply to a nurture email and confirm the workflow stops.

Step 9 is the one people skip. A blank `Budget` on a `HOT` lead means the options step was not
finished, and every downstream workflow condition is reading nothing.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Setup returns 401 | Wrong access code, or 5 failed attempts from your IP | Correct code; wait 15 minutes |
| Setup returns `Forbidden` | Legacy API key used instead of a Private Integration | Create a Private Integration token |
| `CREDENTIAL_ENCRYPTION_KEY is not valid key material` | Key is not 32 bytes | `openssl rand -hex 32` |
| `Missing production configuration` | An env var is unset on the deployment | Set all four required variables |
| Field shows `Created, options needed` | GHL discarded the options | §5, then re-run setup |
| Contact has no budget or timeline | Same as above — values were dropped | §5 |
| Opportunity not created | No pipeline, or the stage name is missing | Build the pipeline per §6, then re-run setup |
| Lead has no tag | The tag is missing from the location | Re-run setup; it creates HOT/WARM/NURTURE |
| Lead not enrolled in nurture | No workflow ID saved | Publish the workflow, paste its ID, re-run setup |
| `Could not create pipeline` | GHL refuses pipeline writes to API tokens | Not a scope problem. Build the pipeline in the UI, per §6 |
| Calendar shows no times | Host has not connected an external calendar | §7 |
| Nurture emails do not arrive | Sender domain not verified | Verify in GHL, then send a test email |
| `Too many submissions from this connection` | Rate limit hit | Wait 10 minutes |
| Duplicate contacts on repeat submissions | Location allows duplicates | GHL → Settings → Duplicates → allow on email only |
| Two different leads collapse into one contact | Location merges on any identifier, not just email | GHL → Settings → Duplicates → **allow on email only**. With the default, a shared phone number merges two people and the second email overwrites the first |

---

## 11. After handover

The token stays live because the app needs it for every lead. Two options:

- **Keep it** — the funnel keeps working unattended. This is the normal choice.
- **Revoke it** if the GHL form is doing the lead capture instead of the app's own form. The
  dashboard and setup will stop working; the app degrades to a local demo rather than failing.

Rotate it by creating a new Private Integration, pasting it into `/setup`, then deleting the old one.
