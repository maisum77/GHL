# Digital Agency Lead-to-Call Funnel — Implementation Plan

> **Revision 2 · Status: ACTIVE · 100% free stack · No GoHighLevel · $0 total cost**
>
> This document supersedes `GHL_Funnel_Implementation_Plan.md` (kept only as historical reference). GoHighLevel is removed from scope and every tool below runs on a **verified free tier**.

## 1. Goal & Final Customer Journey

Build and demonstrate a complete lead-generation funnel for a digital agency that converts website visitors into qualified, booked discovery calls — using only free tools.

```text
Landing Page
    ↓
CTA
    ↓
Qualification Form
    ↓
Lead Scoring
    ↓
Qualified?
   /   \
 Yes    No
 ↓       ↓
Calendar  Nurture
 ↓
Discovery Call
 ↓
Sales Pipeline
```

## 2. What Changed vs. the Original Plan

| # | Original | Now | Reason |
|---|---|---|---|
| 1 | Calendly | **Cal.com (Free)** | Calendly's Free plan has **no API/webhooks** — they are paid-only (Standard, $10/seat/mo). Cal.com Free includes API keys + webhooks, and it is open-source, so self-hosting is a $0 fallback |
| 2 | GoHighLevel | **Removed** | Project requirement: no GHL, must run at $0 |
| 3 | §12 GHL Mapping, §13 GHL Blueprint | **§17 Free-Stack Runbook** | Operational docs for the stack we actually run |
| 4 | Deliverable 09 "GHL Workflow Blueprint" | **"Free-Stack Runbook"** | — |
| 5 | Funnel design, form, scoring, emails, pipeline, dashboard, tracking, testing, demo scenarios | **Unchanged** | Full original spec retained |

## 3. Stack — All Free Tiers (verified)

| Requirement | Tool | Free tier — verified limits | Credentials needed |
|---|---|---|---|
| Landing page | Next.js + Tailwind | Free | none |
| Hosting | Vercel Hobby | Free, includes `*.vercel.app` subdomain | none (optional token) |
| Form | Tally | Unlimited forms & submissions; **webhooks + integrations included free** | Form ID only (no secret) |
| Automation | n8n self-hosted (Community Edition, Docker) | Unlimited executions | `N8N_ENCRYPTION_KEY`; optional API key |
| Public webhook URL | Cloudflare quick tunnel (no account) or ngrok free (1 static domain) | Free | ngrok: free account only |
| CRM / Database | Airtable Free | 1,000 records/base; API included (5 req/s) | PAT + Base ID |
| Calendar | Cal.com Free | Unlimited 1-on-1 bookings; API + webhooks | API key + webhook signing secret |
| Email | Brevo Free | **300 emails/day, free forever**; API + SMTP included | API key + verified sender |
| Analytics | GA4 + Microsoft Clarity | Free | Measurement ID + Project ID |

**Notes**

- Vercel Hobby is licensed for **non-commercial** use — fine for this demo/portfolio build.
- Optional extras (not required): custom domain ≈ $10/yr; Brevo Starter ≈ $9/mo if ever needed.
- Cal.com fallback if anything is ever gated on their free tier: **Google Calendar "Appointment Schedules" + n8n's Google Calendar Trigger** — also $0.

## 4. Accounts & Credentials — The Complete List

Everything below is **free**. Total setup time ≈ 20–30 minutes.

### 4.1 Signup checklist — what to create and copy out

| ☐ | Service | Do this | Copy this out |
|---|---|---|---|
| ☐ | **Tally** | Sign up → build the form in §7 → Integrations → Webhooks (add once §9 is running — webhooks are free) | **Form ID** (from the form's share link) |
| ☐ | **Airtable** | Sign up → create the "Digital Agency CRM" base (§14) | **Base ID** (`app…`, from the base URL) + **Personal Access Token** (airtable.com/create/tokens · scopes: `data.records:read`, `data.records:write`, `schema.bases:read`) |
| ☐ | **Docker Desktop** | Install (free for personal use) → run n8n (§9) | **`N8N_ENCRYPTION_KEY`** — generate yourself: `openssl rand -hex 32` |
| ☐ | **n8n API key** *(optional)* | n8n UI → Settings → n8n API → Create key (Community Edition supports this) | **API key** (needed only for the n8n-mcp server, §5) |
| ☐ | **Cal.com** | Sign up → create the "30-Minute Discovery Call" event (§13) | **Booking URL** (`cal.com/<username>/30min`), **Event Type ID**, **API key** (Settings → Developer → API keys), **Webhook signing secret** |
| ☐ | **Brevo** | Sign up → **verify your sender email** (Senders & Domains) | **API key** (`xkeysib-…`, from SMTP & API → API Keys) + **verified sender email** |
| ☐ | **Google Analytics 4** | Create property + web data stream | **Measurement ID** (`G-XXXXXXXXXX`) |
| ☐ | **Microsoft Clarity** | Create project | **Project ID** |
| ☐ | **Vercel** | Sign up with GitHub → import this repo later | *(nothing — git push deploys)* |
| ☐ | **ngrok** *(optional but recommended)* | Free account → claim your 1 free static domain | **Static domain** (keeps the webhook URL stable) |
| ☐ | **GitHub PAT** *(optional)* | Only if using the GitHub MCP server | PAT with `repo` scope |
| ☐ | **Tally API key** *(optional)* | Tally → Settings → API keys (only needed for the Tally MCP) | API key |

### 4.2 Environment variables (templates — never commit real values)

`frontend/.env.local`

```env
NEXT_PUBLIC_TALLY_FORM_ID=
NEXT_PUBLIC_CAL_BOOKING_URL=https://cal.com/<username>/30min
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_CLARITY_PROJECT_ID=
```

`automation/.env` (consumed by docker-compose, §9)

```env
N8N_ENCRYPTION_KEY=            # openssl rand -hex 32 — required; encrypts stored credentials
N8N_API_KEY=                   # optional — only for the n8n-mcp server
WEBHOOK_URL=                   # your tunnel URL, e.g. https://xxxx.trycloudflare.com
```

### 4.3 Stored inside n8n's encrypted credential store (not in .env)

| Credential | Fields it holds |
|---|---|
| Airtable | PAT + Base ID |
| Cal.com | API key (+ webhook secret) |
| Brevo | API key + sender name/email |
| Brevo template IDs (only if using Brevo templates) | email-01 … email-05 template IDs |

### 4.4 Security rules

- The Airtable PAT and Brevo key are **server-side only** — they live in n8n credentials or Vercel env vars, never in frontend code.
- `.env*` files are git-ignored; only `.env.example` templates are committed.
- Never paste real secrets into the plan, README, or demo docs — reference variable names instead.

## 5. MCP Servers (optional AI-assist tools — not required at runtime)

MCP (Model Context Protocol) servers let an AI assistant (Cline, Claude, etc.) work with these tools directly while we build. The funnel itself does **not** depend on any of them.

| MCP server | Cost | Credentials | Use in this project |
|---|---|---|---|
| **Tally MCP** (official) | **Free on all plans** | OAuth (recommended) or Tally API key · server URL `https://api.tally.so/mcp` | Create/edit the §7 form from a plain-language description; fetch + analyze submissions; run sentiment on open-text answers |
| **n8n-mcp** (community, MIT, 23k★) | Self-hosted, free | `N8N_API_URL` (http://localhost:5678) + `N8N_API_KEY` | Generate and validate the §10 workflow JSON; debug executions |
| **Playwright MCP** (Microsoft) | Free | none | End-to-end testing of the funnel (§18) from the browser |
| **GitHub MCP** | Free | GitHub PAT (`repo` scope) | Manage this repository; open issues from the testing checklist |
| **Airtable connector** | Free | Airtable PAT | Maintain the §14 CRM schema and records conversationally |

## 6. Landing Page (Next.js + Tailwind → Vercel)

**Objective:** convert visitors into people willing to complete the qualification form.

### Hero

- **Headline:** Turn More Website Visitors Into Qualified Sales Calls
- **Subheadline:** We build conversion-focused websites, funnels, and automation systems that help digital agencies turn traffic into real business opportunities.
- **Primary CTA:** Book a Free Discovery Call → links to the qualification form (`/apply`)

### Sections (build in this order)

1. Hero → 2. Problem → 3. Services → 4. How the process works → 5. Why work with us → 6. Case studies / portfolio → 7. FAQ → 8. Final CTA → 9. Footer

### Conversion principles

One primary CTA · value proposition above the fold · minimal navigation · strong social proof · mobile-first · fast loading · short sections · repeat the CTA after each major section.

### Implementation notes

- Next.js (App Router) + Tailwind. Routes: `/` (landing), `/apply` (Tally embed), `/book` (Cal.com embed), `/dashboard` (optional, §15).
- Tally embedded via `https://tally.so/embed/<FORM_ID>` (iframe/script) using `NEXT_PUBLIC_TALLY_FORM_ID`.
- GA4 via `@next/third-parties/google`; Clarity via a small script tag.
- Every CTA forwards UTM parameters from the visitor's URL (§16).
- Deploy: import the GitHub repo into Vercel (Hobby), add env vars in the Vercel dashboard.

## 7. Qualification Form (Tally — free)

**Contact information:** Full Name · Email · Phone · Company Name · Website URL

**Project information:**

- *What service are you interested in?* — Website Development · Landing Page · SaaS / Web Application · AI Automation · CRM / Funnel · E-commerce · Other
- *What is your biggest challenge?* — Not getting enough leads · Website isn't converting · Manual processes · Need a new website · Need automation · Need an MVP · Other
- *What is your approximate budget?* — Under $500 · $500–$1,500 · $1,500–$3,000 · $3,000–$5,000 · $5,000+
- *When are you looking to start?* — Immediately · Within 30 days · 1–3 months · Just researching
- *Do you already have a website?* — Yes / No
- *Anything else we should know?* — long-text

**Hidden fields (for tracking — §16):** `utm_source`, `utm_medium`, `utm_campaign`, `landing_page` (auto-filled from URL parameters)

**Webhook:** Tally → Integrations → Webhooks → `https://<tunnel>/webhook/tally-lead` (free feature). Expected payload fields: `name, email, phone, company, website, service, challenge, budget, timeline, existing_website, message` + hidden UTM fields.

⚠️ Keep the budget/timeline option labels **character-for-character identical** to the scoring constants in §8.

## 8. Lead Scoring

| Condition | Points |
|---|---:|
| Budget $3,000+ (i.e. "$3,000–$5,000" or "$5,000+") | +30 |
| Budget $1,500–$3,000 | +20 |
| Budget $500–$1,500 | +10 |
| Start immediately | +20 |
| Start within 30 days | +15 |
| Existing website | +10 |
| Clear business/project need — *defined as: a specific challenge selected (anything except "Other" or blank)* | +10 |

**Classification:** `70+ = HOT` · `40–69 = WARM` · `0–39 = NURTURE` (max possible = 70, so HOT requires all four positives). **Never expose the score to the visitor.**

Scoring code (n8n Code node "Calculate Lead Score" — Node 3 in §10):

```javascript
const item = $input.first().json;
let score = 0;
if (["$3,000–$5,000", "$5,000+"].includes(item.budget)) score += 30;
else if (item.budget === "$1,500–$3,000") score += 20;
else if (item.budget === "$500–$1,500") score += 10;
if (item.timeline === "Immediately") score += 20;
else if (item.timeline === "Within 30 days") score += 15;
if (item.existingWebsite === true) score += 10;
if (item.challenge && item.challenge !== "Other") score += 10;
const leadStatus = score >= 70 ? "HOT" : score >= 40 ? "WARM" : "NURTURE";
return [{ json: { ...item, leadScore: score, leadStatus } }];
```

## 9. Automation Infrastructure (n8n + free tunnel)

### 9.1 n8n — self-hosted Community Edition (Docker, free)

`automation/docker-compose.yml`

```yaml
services:
  n8n:
    image: docker.n8n.io/n8nio/n8n
    ports:
      - "5678:5678"
    env_file: [.env]
    environment:
      - WEBHOOK_URL=${WEBHOOK_URL}
      - GENERIC_TIMEZONE=UTC        # set your timezone, e.g. Europe/Berlin
    volumes:
      - n8n_data:/home/node/.n8n    # workflow + credential persistence
volumes:
  n8n_data:
```

Start: `cd automation && docker compose up -d` → editor at `http://localhost:5678` (first launch asks you to create the owner account).

### 9.2 Public URL for webhooks (Tally and Cal.com must reach n8n)

| Option | Command | Stability |
|---|---|---|
| **A. Cloudflare quick tunnel** (no account) | `cloudflared tunnel --url http://localhost:5678` | random `https://*.trycloudflare.com` URL — changes on restart |
| **B. ngrok free** (recommended) | free account → claim the 1 free static domain → `ngrok http 5678 --url https://<your-domain>.ngrok-free.app` | stable URL that never changes |

Set `WEBHOOK_URL` (in `automation/.env`) to the tunnel URL so n8n generates correct webhook URLs. With Option A, re-copy the webhook URLs into Tally and Cal.com after every tunnel restart (see runbook, §17).

### 9.3 Wiring

- **Tally** → Integrations → Webhooks → `https://<tunnel>/webhook/tally-lead`
- **Cal.com** → Settings → Developer → Webhooks → `https://<tunnel>/webhook/cal-booking` *(or use n8n's Cal Trigger node, which registers the webhook for you via the Cal.com API)*

## 10. n8n Workflow — "WORKFLOW 01: New Lead Qualification"

```text
Tally Webhook
     ↓
Normalize Form Data          (Set node)
     ↓
Calculate Lead Score         (Code node, §8)
     ↓
Create / Update Airtable Contact   (upsert on Email)
     ↓
IF leadStatus is HOT or WARM
       ↓
   ┌───┴────┐
   ↓        ↓
HOT/WARM  NURTURE
   ↓        ↓
Brevo:     Brevo email 1 → Wait 1d → email 2 → Wait 2d → email 3
Booking    → Wait 2d → email 4 → Wait 2d → email 5
email  ↓
Airtable Opportunity
(Pipeline Stage = QUALIFIED)
```

### Node-by-node

| # | Node | Type | Details |
|---|---|---|---|
| 1 | Tally Webhook | Webhook (POST `/webhook/tally-lead`) | Receives `name, email, phone, company, website, service, challenge, budget, timeline, existing_website, message` + UTM hidden fields |
| 2 | Normalize Form Data | Set | Produces `{ name, email, phone, company, website, service, challenge, budget, timeline, existingWebsite, message, utmSource, utmMedium, utmCampaign, landingPage }` (trim whitespace, lowercase email, `existing_website` → boolean) |
| 3 | Calculate Lead Score | Code | §8 snippet → `leadScore`, `leadStatus` |
| 4 | Create / Update Contact | Airtable (upsert on Email) | Fields per §14 |
| 5 | Check Classification | IF | TRUE when `leadStatus == HOT` or `WARM` |
| 6a | Send Booking Email | Brevo | Qualified flow (§11) |
| 6b | Create Opportunity | Airtable | `Pipeline Stage = QUALIFIED`, `Lead Status = HOT/WARM` |
| 7 | Nurture Sequence | Brevo + Wait nodes | 5-email drip (§12): immediate → +1d → +3d → +5d → +7d |

**Notes**

- Wait nodes persist across restarts (data lives in the `n8n_data` volume) — the multi-day drip survives reboots.
- Log every branch to Airtable (`Notes` field: "Workflow 01 — HOT branch taken at <timestamp>") for demo visibility.
- Use pinned test data in the Webhook/Code nodes for fast iteration.

## 11. Qualified Lead Flow (HOT & WARM)

**Immediate email**

Subject: `Let's discuss your project`

> Thanks for sharing your project details. Based on the information you provided, we'd love to learn more about what you're building.
>
> You can choose a convenient time for a discovery call below.
>
> [BOOK YOUR DISCOVERY CALL] ← button → Cal.com booking link (§13)

**Airtable:** create Opportunity with `Pipeline Stage = QUALIFIED`, `Lead Status = HOT/WARM`.

## 12. Nurture Flow (NURTURE leads)

| # | Send time | Subject | Focus |
|---|---|---|---|
| 1 | Immediately | Thanks for reaching out | Confirm receipt; short agency intro |
| 2 | +1 day | Your website should do more than look good | Importance of conversion-focused websites |
| 3 | +3 days | How we approach digital projects | Process: Understand → Plan → Build → Automate → Optimize |
| 4 | +5 days | Could we help with your project? | Relevant case study / portfolio example |
| 5 | +7 days | Want to discuss your project? | Final CTA to book a discovery call |

Full email copy lives in `emails/email-01.md` … `emails/email-05.md`. Send via the Brevo node (inline HTML) or Brevo templates (store template IDs in n8n credentials).

## 13. Booking Calendar (Cal.com — free)

- **Event:** 30-Minute Discovery Call
- **Booking questions:** Name · Email · Company · Website · Project type · Main challenge
- Embed the booking page on `/book` (Cal.com embed) and link it in the qualified email (§11).
- **After a booking is made:**

```text
Cal.com (BOOKING_CREATED webhook)
   ↓
n8n (Webhook node — verify signing secret)
   ↓
Find Airtable Contact (by attendee email)
   ↓
Update Pipeline Stage → CALL BOOKED
   ↓
Set Call Date = booking start time
```

- Optional events handled the same way: `BOOKING_CANCELLED` (→ back to QUALIFIED + note), `BOOKING_RESCHEDULED` (→ update Call Date).

## 14. CRM / Sales Pipeline (Airtable — free)

**Base:** `Digital Agency CRM` (1,000 records/base on Free — plenty; watch it during bulk testing)

**Table `Contacts`**

| Field | Type |
|---|---|
| Name, Email, Phone, Company, Website | text |
| Service, Challenge, Budget, Timeline | single select |
| Existing Website | checkbox |
| Lead Score | number |
| Lead Status | single select: HOT / WARM / NURTURE |
| Pipeline Stage | single select: NEW LEAD / QUALIFIED / CALL BOOKED / DISCOVERY COMPLETED / PROPOSAL SENT / NEGOTIATION / WON / LOST |
| Call Date | date-time |
| Notes | long text |
| Source, UTM Source, UTM Medium, UTM Campaign, Landing Page | text |
| Created At | created-time |

**Table `Opportunities`**

| Field | Type |
|---|---|
| Name (e.g. "Acme — Website Development") | text |
| Contact | link → Contacts |
| Pipeline Stage | single select (same 8 stages) |
| Lead Status | single select |
| Value | currency (optional) |
| Call Date | date-time |
| Notes | long text |
| Created At | created-time |

**Pipeline:** `NEW LEAD → QUALIFIED → CALL BOOKED → DISCOVERY COMPLETED → PROPOSAL SENT → NEGOTIATION → WON → LOST`

## 15. Dashboard

Metrics to display:

- Total Leads · Qualified Leads · Calls Booked · Calls Completed · Proposals · Won Deals · Lost Deals
- Lead Status split: HOT / WARM / NURTURE
- Pipeline view: NEW LEAD → QUALIFIED → CALL BOOKED → PROPOSAL SENT → WON

Implementation options (pick the cleaner demo):

1. **Airtable views (guaranteed free):** Kanban grouped by Pipeline Stage + a summary view for lead-status counts.
2. **`/dashboard` page in the Next.js app (recommended for the demo):** read-only; fetches the base through a **server-side API route** (PAT stored in Vercel env vars — never sent to the browser); renders counters + a small funnel.

## 16. Tracking

Add UTM parameters to campaign links:

```text
https://<landing-page>?utm_source=linkedin&utm_medium=social&utm_campaign=agency_leads
```

**Flow:** URL params → Tally hidden fields → n8n → Airtable (`Source`, `UTM Source/Medium/Campaign`, `Landing Page`).

**Track:** Source · Medium · Campaign · Landing Page · Form Submission · Qualified Lead · Booking

**Analytics:**

- **GA4** — page views + custom events: `cta_click`, `form_view`, `form_submit`, `booking_click` (send via `gtag()`)
- **Microsoft Clarity** — session recordings + heatmaps (free) to see where visitors hesitate on the landing page

## 17. Free-Stack Runbook (replaces the GHL Blueprint)

### Starting the system (every session)

1. `cd automation && docker compose up -d` — starts n8n
2. Start the tunnel (§9.2) and copy the current URL
3. If the URL changed (Cloudflare option only): update the Tally webhook URL, the Cal.com webhook URL, and `WEBHOOK_URL` in `automation/.env`, then `docker compose up -d` again
4. Smoke-test: `curl -X POST <tunnel>/webhook/tally-lead -H "Content-Type: application/json" -d @automation/test-payloads/hot-lead.json`

### Weekly checks

- Airtable: record count (free limit 1,000/base)
- Brevo: sends used today (free limit 300/day)
- n8n: executions stuck in "Waiting" are the healthy nurture drip; errors indicate bad credentials

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Webhook returns 404 | Tunnel down or URL changed | Restart tunnel; re-paste URLs (or switch to the ngrok static domain) |
| Lead not created in Airtable | PAT scopes / Base ID wrong | Re-check `data.records:write` scope + base ID |
| Emails not arriving | Sender not verified / daily limit / spam folder | Verify sender in Brevo; check 300/day cap; check spam |
| Booking doesn't move the pipeline | Webhook secret mismatch or attendee email ≠ contact email | Re-verify webhook secret; use the exact same email in form and booking |
| Nurture drip stops | n8n container restarted mid-wait | Waits persist in the volume — check the Executions view |

## 18. Testing Checklist

**Landing page**
- [ ] Desktop layout works
- [ ] Mobile layout works
- [ ] CTA works (scrolls to / opens the form)
- [ ] Form opens correctly
- [ ] No broken links

**Form**
- [ ] Required fields work
- [ ] Validation works
- [ ] Form submits
- [ ] Webhook receives data (visible in n8n executions)

**Automation**
- [ ] Lead created in Airtable
- [ ] Lead score calculated correctly
- [ ] HOT classified correctly (≥70)
- [ ] WARM classified correctly (40–69)
- [ ] NURTURE classified correctly (≤39)
- [ ] Correct email branch starts

**Booking (Cal.com)**
- [ ] Booking page works
- [ ] Appointment can be booked
- [ ] Contact is updated
- [ ] Pipeline changes to CALL BOOKED

**CRM**
- [ ] Lead appears with complete data
- [ ] Pipeline stage changes correctly
- [ ] Notes can be added

## 19. Demo Scenarios

| Test | Inputs | Scoring math | Expected |
|---|---|---|---|
| **A — HOT** | Budget `$5,000+` · Immediately · Existing website: Yes · Challenge: specific | 30+20+10+10 = **70** | HOT → QUALIFIED → booking CTA → CALL BOOKED |
| **B — WARM** | Budget `$1,500–$3,000` · Within 30 days · Existing website: Yes | 20+15+10 = **45** | WARM → QUALIFIED → booking CTA *(include "Existing website: Yes" — without it the score is 35 → NURTURE)* |
| **C — NURTURE** | Budget `Under $500` · Just researching | **0** | NURTURE → 5-email sequence → long-term follow-up |

## 20. Deliverables

```text
01. Landing Page
02. Qualification Form
03. Lead Scoring System
04. Automation Workflow
05. Email Nurture Sequence
06. Booking Calendar (Cal.com)
07. CRM / Sales Pipeline (Airtable)
08. Analytics (GA4 + Clarity)
09. Free-Stack Runbook
10. Testing Documentation
```

## 21. Project Structure

```text
agency-funnel/
│
├── frontend/
│   ├── app/                 # /, /apply, /book, /dashboard, /api/...
│   ├── components/
│   ├── public/
│   └── styles/
│
├── automation/
│   ├── docker-compose.yml
│   ├── .env.example
│   ├── n8n-workflow.json
│   ├── test-payloads/       # hot-lead.json, warm-lead.json, nurture-lead.json
│   └── README.md
│
├── emails/
│   └── email-01.md … email-05.md
│
├── crm/
│   └── airtable-schema.md
│
├── docs/
│   ├── free-stack-runbook.md
│   └── testing.md
│
└── README.md
```

## 22. Build Milestones

| # | Milestone | Deliverable | Done when |
|---|---|---|---|
| M0 | Plan | This document (committed) | ✅ |
| M1 | Scaffold | `agency-funnel/` structure + README + docs stubs | Structure matches §21 |
| M2 | Landing page | Next.js page with all 9 sections + analytics + CTAs | Deployed on Vercel; mobile + desktop pass §18 checks |
| M3 | Form | Tally form per §7 + hidden UTM fields | Submissions arrive at the n8n webhook |
| M4 | CRM | Airtable base per §14 with kanban views | Contacts + Opportunities populated by the workflow |
| M5 | Automation | n8n infra (§9) + Workflow 01 (§10) | Demo payloads A/B/C produce correct scores + rows |
| M6 | Emails | Brevo wired; 5 nurture templates committed in `emails/` | Test A/B receive the booking email; Test C receives drip #1 |
| M7 | Booking | Cal.com event + webhook → pipeline update | Booking moves the contact to CALL BOOKED |
| M8 | Dashboard | Airtable views and/or `/dashboard` route | Counters match CRM data |
| M9 | Testing | §18 checklist executed; §19 scenarios recorded | All boxes ticked; screenshots/logs saved |
| M10 | Docs & demo | Runbook, testing doc, README polished | A stranger can restart the system in <10 min using the runbook |

## 23. Definition of Done

- [ ] All three demo scenarios (A/B/C) pass **end-to-end** on the deployed URL
- [ ] Tally → n8n → Airtable verified for all three classifications
- [ ] Qualified email + 5-email nurture sequence delivered via Brevo
- [ ] Cal.com booking automatically moves the opportunity to CALL BOOKED
- [ ] Landing page has GA4 page views + Clarity recordings for a test visit
- [ ] Total spend: **$0.00**
- [ ] GHL is not referenced anywhere in the delivered system

## 24. Presentation Notes

Present it as:

> "I built and tested the complete lead-to-call funnel architecture on a 100% free, production-grade stack — landing page, qualification, lead scoring, automation, CRM, booking, and pipeline — all running end-to-end at zero cost."

Then demonstrate the journey live:

```text
Visitor
  ↓
Landing Page
  ↓
Qualification
  ↓
Lead Scoring
  ↓
Automation
  ↓
CRM
  ↓
Booking
  ↓
Sales Pipeline
```

Close with the ROI framing: every component has a paid upgrade path (custom domain, higher email volume, paid CRM) but the architecture itself costs nothing to run — proving the funnel works before any money is spent.
