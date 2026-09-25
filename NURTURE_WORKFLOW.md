# Nurture Workflow — Build Guide

The website app **enrolls every new lead into this workflow automatically**. You do not add
triggers or conditions for form submissions — the app calls GHL's enrollment endpoint on
each submission. This workflow only defines what happens *after* enrollment.

GHL's public API cannot create or edit workflows, so this is the one piece that must be
built by hand. Budget about 15 minutes.

---

## 1. Create the workflow

**Workflows → New Workflow → Start from scratch**

| Setting | Value |
|---|---|
| Name | `Lead Nurture` |
| Status | Draft until the checks in §6 pass, then Publish |
| Enrolment | Allow re-enrolment: **off** (one pass per contact) |
| Stop on reply | **on** |

The exact name matters. If you name it something else, paste its workflow ID into the setup
wizard instead — the wizard accepts either the name `Lead Nurture` or an explicit ID.

---

## 2. The first step must be a branch

Immediately after the trigger, add an **If/Else** condition:

```
Contact → Lead Status  is  equal to  HOT
```

- **Yes → Booking CTA branch** (§3). Hot leads have already cleared the bar; do not drip them.
- **No → Nurture sequence** (§4).

The app writes `Lead Status` on every submission, so this condition is what keeps hot leads
from being nurtured.

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

The setup wizard already created the contact fields, tags, and pipeline. Confirm each line:

- [ ] `Lead Status` has options `HOT`, `WARM`, `NURTURE` (the wizard reports any field whose options it could not set)
- [ ] `Budget` has all five options
- [ ] `Timeline` has all four options
- [ ] `Service` has all seven options
- [ ] Condition 1 in §2 reads `Lead Status` = `HOT`
- [ ] Every email has a booking link
- [ ] Sender domain is verified — send a test email to yourself
- [ ] Exit conditions from §4 are set
- [ ] Publish the workflow, then paste its ID into the setup wizard
- [ ] Re-run setup so the stored ID is saved

If the wizard reported a field as `Created, options needed`, fix that field **before** testing.
GHL silently discards picklist values that are not real options, so a lead can score as
`NURTURE` while its budget is empty.
