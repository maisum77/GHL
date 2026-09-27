# Nurture Workflow — Build Guide

The website app **enrolls every new lead into this workflow automatically**. You do not add
triggers or conditions for form submissions — the app calls GHL's enrollment endpoint on
each submission. This workflow only defines what happens *after* enrollment.

GHL's public API cannot create or edit workflows, so this is the one piece that must be
built by hand. Budget about 15 minutes.

---

## 0. Choose a variant first

A sending domain is what makes cold nurture email deliverable, and it is not needed for the
workflow to exist or for the rest of the funnel to work. GHL's **Internal Notification** action
delivers to your own user inbox and does **not** require a verified sender domain.

| | Variant A — start here | Variant B — add later |
|---|---|---|
| Needs a domain | No | Yes |
| HOT lead | Instant notification in GHL + `Qualified` tag | Notification **and** a booking CTA email |
| Nurture lead | Tagged for follow-up, no automated email | 6 emails over 14 days |
| Setup | 5 minutes | + the six email steps in §3–§5 |

**Build Variant A first.** Every step in it is kept in Variant B, so upgrading later is purely
additive — you insert email steps into a workflow you already published. Nothing is rebuilt and
no lead is re-enrolled.

Skip to §1A for Variant A. §3–§5 are the Variant B add-on.

---

## 1A. Variant A — notifications and tags (no domain required)

**Workflows → New Workflow → Start from scratch**

| Setting | Value |
|---|---|
| Name | `Lead Nurture` |
| Enrolment | Allow re-enrolment: **off** (one pass per contact) |

The exact name matters — the app finds this workflow by name. If you name it something else,
paste its ID into the setup wizard instead.

### Step 1 — If/Else on `Lead Status`

**The app enrols every lead, not just hot ones.** A HOT-only notification therefore needs a
branch, or a score-0 NURTURE enquiry pings you claiming an opportunity is waiting at
*Qualified* when it is actually at *New Lead*. Alerts that are sometimes false are alerts you
learn to ignore.

Drag an **If/Else** action onto the canvas as the first step:

```
Contact → Lead Status  is  equal to  HOT
```

- **Yes →** Step 2
- **No →** Step 5

### Step 2 — Internal Notification

On the **Yes** branch, add an **Internal Notification** action.

- **Recipient:** yourself (the workflow's owner)
- **Subject:** `HOT lead — {{contact.name}}`
- **Body:**

  > `{{contact.name}}` just applied.
  >
  > Budget: `{{contact.Budget}}` · Timeline: `{{contact.Timeline}}` · Score: `{{contact.Lead Score}}`
  >
  > An opportunity is already open in Agency Funnel at **Qualified**. Call them.

- **Send immediately** — no Wait step before this one. A hot lead is the one notification you
  actually want in real time.

### Step 3 — Add Tag

Still on the **Yes** branch, add an **Add Tag** action: `Qualified`.

This gives the workflow an exit hook: `Qualified` is one of the stop conditions in Step 4, so a
lead who has already been qualified can never be re-engaged by a later run.

### Step 4 — Exit conditions

Set the workflow's **stop on** conditions so it never fires on someone who converted:

- Contact has opportunity in stage `Call Booked` → stop
- Contact has tag `Qualified` → stop
- Contact is marked Do Not Contact → stop

### Step 5 — The No branch

Leave the **No** branch empty for now, or add a single **Add Tag**: `Nurture Sequence` so you can
segment everyone currently in nurture from a single tag. Do not email anyone from this branch —
that is Variant B, and it needs a verified sending domain.

### Step 6 — Publish

- [ ] Workflow named exactly `Lead Nurture`
- [ ] If/Else on `Lead Status = HOT` is the first step
- [ ] Internal Notification is on the **Yes** branch, no Wait before it
- [ ] Notification body uses the `{{contact.Budget}}` / `{{contact.Timeline}}` merge fields
- [ ] `Add Tag: Qualified` follows the notification
- [ ] All three stop conditions set
- [ ] **Published** (not draft — the app only enrols into published workflows)
- [ ] Workflow ID copied

Then return to `/setup` and paste the workflow ID. That is Variant A complete: hot leads alert
you the moment they land, with a `Qualified` opportunity already waiting, and nobody else makes
noise.

---

## Variant B — the email sequence

Everything below is the upgrade you apply once you have a verified sending domain. Add it to
the workflow from §1A; do not rebuild it.

Extend the existing **If/Else** from §1A Step 1. The `Lead Status = HOT` branch you already have
becomes the HOT email path; the **No** branch becomes the nurture drip. Insert the Wait and
Send Email steps of §3 and §4 underneath them. Keep the notification on both branches — it stays
useful once email is live.

---

## 2. What the branch looks like after the upgrade

```
Contact → Lead Status  is  equal to  HOT
```

- **Yes → Booking CTA branch** (§3). Hot leads have already cleared the bar; do not drip them.
- **No → Nurture sequence** (§4).

Both branches keep the §1A notification. The app writes `Lead Status` on every submission, so
this condition is what keeps hot leads from being nurtured.

---

## 3. HOT branch — booking CTA

| # | Action | Detail |
|---|---|---|
| 1 | Wait | 0 minutes |
| 2 | Send Email | Subject: `Your discovery call — pick a time that works` |
| 3 | Add Tag | `Qualified` |
| 4 | Wait | 1 day |
| 5 | If/Else | `Contact → Call Booked` is **not** set |
| 6 | Send Email | Subject: `Still worth a conversation?` — one-line nudge plus booking link |
| 7 | Wait | 3 days |
| 8 | If/Else | `Contact → Call Booked` is **not** set |
| 9 | Internal Notification | "Hot lead has not booked after 4 days" |

Step 5 is the important one: the branch ends as soon as the lead books, so a booked call is
never followed by a booking nudge.

---

## 4. Nurture sequence — six touches over 14 days

Add a **Wait** step before each email so the pacing is explicit and editable.

| # | Wait | Subject | Angle |
|---|---|---|---|
| 1 | 0 min | `The 3-question site audit` | Deliver something useful immediately. No ask. |
| 2 | 2 days | `What we fixed for a [similar business]` | One case study, specific numbers. |
| 3 | 3 days | `The most common mistake we see` | Educational teardown. Positions you as expert. |
| 4 | 4 days | `How we price a project` | Removes the "what will this cost me" objection. |
| 5 | 5 days | `A 30-minute call, not a sales pitch` | Soft CTA. State plainly what the call is and is not. |
| 6 | 4 days | `Should I close your file?` | Breakup. No guilt, no fake scarcity. |

Then stop. Do not loop the sequence.

### Optional mid-sequence branch

Between touches 3 and 4, add a check on **Budget**:

```
Contact → Budget  is one of   $3,000–$5,000, $5,000+
```

If yes, jump straight to touch 5. Those leads are the most valuable and do not need the full
education run.

### Exit conditions

Add these to the workflow's stop settings so nurture never fires on someone who converted:

- Contact has opportunity in stage `Call Booked` → stop
- Contact has tag `Qualified` → stop
- Contact is marked Do Not Contact → stop

---

## 5. Email copy

Keep the sender domain verified (LC Email or Google Workspace) — this is the one manual
prerequisite that silently breaks email. Every email ends with the booking link and a plain
text alternative.

**Touch 1 — The 3-question site audit**

> Subject: The 3-question site audit
>
> Hi `{{contact.first_name}}`,
>
> Thanks for the note about `{{contact.Challenge}}`. Rather than send you a pitch, here's
> something you can use today.
>
> Three questions worth answering on your own site:
>
> 1. Can a stranger tell what you do within five seconds of landing?
> 2. Is there one obvious next step, or three competing ones?
> 3. If someone wanted to buy on a Tuesday afternoon, what would happen?
>
> Most sites fail one of these. It is usually not a copy problem.
>
> — `{{agency.sender_name}}`

**Touch 2 — Case study**

> Subject: What we fixed for a `[similar business]`
>
> `{{contact.first_name}}`, short version of a recent project.
>
> They came to us with `[the problem they described]`. Here is what we did and what it did.
>
> **Before:** `[metric]`
> **After:** `[metric]`
> **Time to result:** `[weeks]`
>
> `[One sentence on why their situation is or isn't the same as yours.]`

**Touch 3 — Common mistake**

> Subject: The most common mistake we see
>
> `{{contact.first_name}}`,
>
> The most expensive mistake we see is treating a website as the asset instead of the
> conversion path that feeds it.
>
> `[Explain in 3–4 sentences, specific to their stated challenge.]`
>
> The fix is usually unglamorous: one page, one offer, one call to action.

**Touch 4 — Pricing**

> Subject: How we price a project
>
> `{{contact.first_name}}`,
>
> You mentioned a budget of `{{contact.Budget}}`. Here is honestly what that buys.
>
> `[Range, what is included, what is not, and what would push it into the next tier.]`
>
> If that range does not fit what you need, say so and we will point you somewhere better.

**Touch 5 — Soft CTA**

> Subject: A 30-minute call, not a sales pitch
>
> `{{contact.first_name}}`,
>
> If the plan above makes sense, the next step is 30 minutes.
>
> We will look at your current site together, agree on the single highest-leverage change,
> and you will have a clear next step whether or not you work with us. No deck.
>
> `[Booking link]`
>
> If it is not a fit, reply with "not now" and we will leave you alone.

**Touch 6 — Breakup**

> Subject: Should I close your file?
>
> `{{contact.first_name}}`,
>
> I have not heard back, which usually means the timing is wrong rather than the work is.
>
> I will stop here. If this becomes a priority, `[booking link]` is always there.
>
> — `{{agency.sender_name}}`

---

## 6. Before you publish

### 6.1 Every variant

The setup wizard already created the contact fields, tags, and pipeline. Confirm each line:

- [ ] `Lead Status` has options `HOT`, `WARM`, `NURTURE`
- [ ] `Budget` has all five options (note the en dashes: `$500–$1,500`, not a hyphen)
- [ ] `Timeline` has all four options
- [ ] `Service` has all seven options
- [ ] `Existing Website` has options `Yes`, `No`
- [ ] All three stop conditions are set (`Call Booked`, `Qualified`, Do Not Contact)
- [ ] **Published**, not left as a draft — the app only enrols into published workflows
- [ ] Workflow ID pasted into the setup wizard, and setup re-run so the ID is stored

If the wizard reported a field as `Created, options needed`, fix that field **before** testing.
GHL silently discards picklist values that are not real options, so a lead can score as
`NURTURE` while its budget is empty.

### 6.2 Variant A only

- [ ] Internal Notification is the first step, with no wait before it
- [ ] `Add Tag: Qualified` follows the notification

Done. A HOT lead will notify you the second it lands. Skip the rest.

### 6.3 Variant B only

- [ ] Condition in §2 reads `Lead Status` = `HOT`
- [ ] Every email has a booking link
- [ ] Every email has a plain-text alternative
- [ ] Sender domain is verified — send a test email to yourself and confirm it is not in spam
