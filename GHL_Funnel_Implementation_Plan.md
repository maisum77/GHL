# Digital Agency Lead-to-Call Funnel — Implementation Plan

## Goal

Build and demonstrate a complete lead-generation funnel for a digital agency that converts website visitors into qualified, booked discovery calls.

The production platform requested by the client is GoHighLevel (GHL). Because a GHL subscription is not currently available, build and test the same funnel architecture using free/low-cost tools, then document the exact GHL mapping for production deployment.

## Final Customer Journey

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

---

# 1. Recommended Stack

Use the following stack for the working prototype:

| Requirement | Tool |
|---|---|
| Landing page | Next.js / React + Tailwind OR Framer |
| Form | Tally |
| Automation | n8n |
| Database / CRM | Airtable |
| Calendar | Calendly |
| Email nurture | Brevo |
| Hosting | Vercel |
| Analytics | Google Analytics + Microsoft Clarity |
| Production target | GoHighLevel |

If possible, use **n8n** because the workflow is highly transferable to GHL concepts.

---

# 2. Landing Page

## Objective

Convert visitors into people willing to complete the qualification form.

## Hero

### Headline

> Turn More Website Visitors Into Qualified Sales Calls

### Subheadline

> We build conversion-focused websites, funnels, and automation systems that help digital agencies turn traffic into real business opportunities.

### Primary CTA

> Book a Free Discovery Call

The CTA should lead to the qualification form.

## Sections

Build the page in this order:

1. Hero
2. Problem
3. Services
4. How the process works
5. Why work with us
6. Case studies / portfolio
7. FAQ
8. Final CTA
9. Footer

## Conversion principles

- One primary CTA
- Clear value proposition above the fold
- Minimal navigation
- Strong social proof
- Mobile-first
- Fast loading
- Short sections
- Repeated CTA after major sections

---

# 3. Qualification Form

Create a Tally form.

## Contact Information

- Full Name
- Email
- Phone
- Company Name
- Website URL

## Project Information

### What service are you interested in?

Options:

- Website Development
- Landing Page
- SaaS / Web Application
- AI Automation
- CRM / Funnel
- E-commerce
- Other

### What is your biggest challenge?

Options:

- Not getting enough leads
- Website isn't converting
- Manual processes
- Need a new website
- Need automation
- Need an MVP
- Other

### What is your approximate budget?

Options:

- Under $500
- $500–$1,500
- $1,500–$3,000
- $3,000–$5,000
- $5,000+

### When are you looking to start?

Options:

- Immediately
- Within 30 days
- 1–3 months
- Just researching

### Do you already have a website?

- Yes
- No

### Anything else we should know?

Long-text field.

---

# 4. Lead Scoring

Calculate a lead score after form submission.

## Suggested scoring

| Condition | Points |
|---|---:|
| Budget $3,000+ | +30 |
| Budget $1,500–$3,000 | +20 |
| Budget $500–$1,500 | +10 |
| Start immediately | +20 |
| Start within 30 days | +15 |
| Existing website | +10 |
| Clear business/project need | +10 |

## Lead classification

```text
70+     = HOT
40–69   = WARM
0–39    = NURTURE
```

Do not expose the score to the visitor.

---

# 5. n8n Automation

Create an n8n workflow.

## Workflow

```text
Tally Webhook
     ↓
Normalize Form Data
     ↓
Calculate Lead Score
     ↓
Classify Lead
     ↓
Create / Update Airtable Contact
     ↓
Check Lead Classification
       ↓
   ┌───┴────┐
   ↓        ↓
 HOT/WARM  NURTURE
   ↓        ↓
Send      Start
Booking   Email
Email      Sequence
   ↓
Airtable
Opportunity
```

---

# 6. n8n Nodes

Create the workflow approximately as follows:

### Node 1 — Webhook

Receive the Tally form submission.

Expected fields:

```text
name
email
phone
company
website
service
challenge
budget
timeline
existing_website
message
```

### Node 2 — Set / Normalize Data

Clean the incoming fields.

Example internal structure:

```json
{
  "name": "",
  "email": "",
  "phone": "",
  "company": "",
  "website": "",
  "service": "",
  "challenge": "",
  "budget": "",
  "timeline": "",
  "existingWebsite": false,
  "message": ""
}
```

### Node 3 — Code / Scoring

Calculate:

```text
leadScore
leadStatus
```

Example:

```text
leadScore >= 70 → HOT
leadScore >= 40 → WARM
otherwise → NURTURE
```

### Node 4 — Airtable

Create or update the contact.

Store:

```text
Name
Email
Phone
Company
Website
Service
Challenge
Budget
Timeline
Lead Score
Lead Status
Source
Created At
```

### Node 5 — IF

Check:

```text
leadStatus == HOT
OR
leadStatus == WARM
```

---

# 7. Qualified Lead Flow

For HOT and WARM leads:

## Immediate email

Subject:

> Let's discuss your project

Message:

> Thanks for sharing your project details. Based on the information you provided, we'd love to learn more about what you're building.
>
> You can choose a convenient time for a discovery call below.
>
> [BOOK YOUR DISCOVERY CALL]

The booking button should point to Calendly.

## Airtable

Create an opportunity:

```text
Pipeline Stage = Qualified
Lead Status = HOT/WARM
```

---

# 8. Nurture Flow

For NURTURE leads, start an automated email sequence.

## Email 1 — Immediately

Subject:

> Thanks for reaching out

Explain that their information has been received and briefly introduce the agency.

## Email 2 — +1 day

Subject:

> Your website should do more than look good

Explain the importance of conversion-focused websites.

## Email 3 — +3 days

Subject:

> How we approach digital projects

Explain the agency's process:

```text
Understand
↓
Plan
↓
Build
↓
Automate
↓
Optimize
```

## Email 4 — +5 days

Subject:

> Could we help with your project?

Share a relevant case study or portfolio example.

## Email 5 — +7 days

Subject:

> Want to discuss your project?

Final CTA to book a discovery call.

---

# 9. Calendly

Create a discovery call event.

Recommended:

```text
Event:
30-Minute Discovery Call

Questions:
- Name
- Email
- Company
- Website
- Project type
- Main challenge
```

Embed the calendar on a booking page.

After booking:

```text
Calendly
   ↓
n8n
   ↓
Find Airtable Contact
   ↓
Update Pipeline Stage
   ↓
CALL BOOKED
```

---

# 10. CRM / Sales Pipeline

Create an Airtable base called:

```text
Digital Agency CRM
```

Pipeline stages:

```text
NEW LEAD
    ↓
QUALIFIED
    ↓
CALL BOOKED
    ↓
DISCOVERY COMPLETED
    ↓
PROPOSAL SENT
    ↓
NEGOTIATION
    ↓
WON
    ↓
LOST
```

## Contact fields

```text
Name
Email
Phone
Company
Website
Service
Budget
Timeline
Lead Score
Lead Status
Pipeline Stage
Call Date
Notes
Source
Created At
```

---

# 11. Dashboard

Create an Airtable dashboard or simple frontend dashboard showing:

```text
Total Leads
Qualified Leads
Calls Booked
Calls Completed
Proposals
Won Deals
Lost Deals
```

Also show:

```text
Lead Status
HOT
WARM
NURTURE
```

And:

```text
Pipeline
NEW LEAD → QUALIFIED → CALL BOOKED → PROPOSAL → WON
```

---

# 12. GHL Mapping

When the client provides access to their GoHighLevel account, recreate the prototype using these GHL components.

## Funnel

```text
Landing Page
↓
Qualification Form
↓
Thank You / Booking Page
```

## Custom Fields

Create:

```text
Company
Website
Service
Challenge
Budget
Timeline
Existing Website
Lead Score
Lead Status
```

## Pipeline

```text
New Lead
Qualified
Call Booked
Discovery Completed
Proposal Sent
Negotiation
Won
Lost
```

## Workflow

```text
TRIGGER:
Form Submitted

↓

Create / Update Contact

↓

Calculate / Assign Lead Status

↓

IF Qualified
    ↓
    Send Booking Email
    ↓
    Create Opportunity
    ↓
    Move to Qualified

ELSE
    ↓
    Start Nurture Sequence
```

## Appointment workflow

```text
Appointment Booked
        ↓
Update Contact
        ↓
Move Opportunity
        ↓
CALL BOOKED
        ↓
Confirmation Email
        ↓
Reminder
```

---

# 13. GHL Workflow Blueprint

Document the production workflow like this:

```text
WORKFLOW 01
Name:
New Lead Qualification

Trigger:
Form Submitted

Actions:
1. Create/Update Contact
2. Set custom fields
3. Calculate/assign lead status
4. Create opportunity
5. If qualified → send booking email
6. If nurture → start nurture sequence
```

```text
WORKFLOW 02
Name:
Appointment Booked

Trigger:
Appointment Status = Confirmed

Actions:
1. Update opportunity
2. Move to Call Booked
3. Send confirmation
4. Send reminder
```

```text
WORKFLOW 03
Name:
Post Discovery

Trigger:
Appointment Completed

Actions:
1. Move opportunity to Discovery Completed
2. Notify sales owner
3. Create follow-up task
```

```text
WORKFLOW 04
Name:
No Booking Follow-Up

Trigger:
Qualified lead but no appointment

Actions:
1. Wait 1 day
2. Send reminder
3. Wait 2 days
4. Send case study
5. Wait 4 days
6. Send final booking CTA
```

---

# 14. Tracking

Add UTM parameters to campaign links.

Example:

```text
?utm_source=linkedin
&utm_medium=social
&utm_campaign=agency_leads
```

Track:

```text
Source
Medium
Campaign
Landing Page
Form Submission
Qualified Lead
Booking
```

Use Google Analytics and/or Microsoft Clarity for the prototype.

---

# 15. Testing Checklist

Before presenting the project, test the complete journey.

## Landing Page

- [ ] Desktop layout works
- [ ] Mobile layout works
- [ ] CTA works
- [ ] Form opens correctly
- [ ] No broken links

## Form

- [ ] Required fields work
- [ ] Validation works
- [ ] Form submits
- [ ] Webhook receives data

## Automation

- [ ] Lead is created in Airtable
- [ ] Lead score is calculated
- [ ] HOT lead is classified correctly
- [ ] WARM lead is classified correctly
- [ ] NURTURE lead is classified correctly
- [ ] Correct email sequence starts

## Booking

- [ ] Calendly works
- [ ] Appointment can be booked
- [ ] Contact is updated
- [ ] Pipeline changes to CALL BOOKED

## CRM

- [ ] Lead appears
- [ ] Lead data is complete
- [ ] Pipeline stage changes
- [ ] Notes can be added

---

# 16. Demo Scenarios

Prepare three test users.

## Test A — HOT

```text
Budget: $5,000+
Timeline: Immediately
Existing website: Yes
```

Expected:

```text
HOT
↓
Qualified
↓
Booking CTA
↓
Call Booked
```

## Test B — WARM

```text
Budget: $1,500–$3,000
Timeline: Within 30 days
```

Expected:

```text
WARM
↓
Qualified
↓
Booking CTA
```

## Test C — NURTURE

```text
Budget: Under $500
Timeline: Just researching
```

Expected:

```text
NURTURE
↓
Email Sequence
↓
Long-term follow-up
```

---

# 17. Deliverables

The completed project should contain:

```text
01. Landing Page
02. Qualification Form
03. Lead Scoring System
04. Automation Workflow
05. Email Nurture Sequence
06. Booking Calendar
07. CRM / Sales Pipeline
08. Analytics
09. GHL Workflow Blueprint
10. Testing Documentation
```

---

# 18. Suggested Project Structure

If building the landing page yourself:

```text
agency-funnel/
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── public/
│   └── styles/
│
├── automation/
│   ├── n8n-workflow.json
│   └── README.md
│
├── emails/
│   ├── email-01.md
│   ├── email-02.md
│   ├── email-03.md
│   ├── email-04.md
│   └── email-05.md
│
├── crm/
│   └── airtable-schema.md
│
├── ghl/
│   └── ghl-implementation.md
│
└── README.md
```

---

# 19. Final Presentation

Do not present this as:

> "I couldn't use GHL."

Present it as:

> "I built and tested the complete lead-to-call funnel architecture using an equivalent automation stack, and documented the exact GHL implementation so it can be deployed into the client's GHL account."

Then demonstrate:

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

The goal is to prove that the entire customer journey works before moving it into the client's production GHL account.
