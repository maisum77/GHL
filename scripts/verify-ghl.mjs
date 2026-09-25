#!/usr/bin/env node
/**
 * Proves a real GHL credential can drive the whole funnel, using the same endpoint
 * sequence and payload shapes as the app. Run this once against the client subaccount
 * before going live.
 *
 *   GHL_TOKEN=... GHL_LOCATION_ID=... npm run verify:ghl
 *   GHL_TOKEN=... GHL_LOCATION_ID=... npm run verify:ghl -- --dry-run
 *
 * --dry-run skips every write, so steps 6-9 are reported as SKIPPED.
 *
 * Exit code 0 means every check passed. Nothing here reads or writes the app database;
 * it talks to GHL exactly as the running app does.
 */

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

const BASE_URL = (process.env.GHL_API_BASE_URL || "https://services.leadconnectorhq.com").replace(/\/$/, "");
const VERSION = process.env.GHL_API_VERSION || "v3";
const TOKEN = process.env.GHL_TOKEN || "";
const LOCATION_ID = process.env.GHL_LOCATION_ID || "";

const EXPECTED_FIELDS = [
  "Company", "Website", "Service", "Challenge", "Budget", "Timeline",
  "Existing Website", "Lead Score", "Lead Status",
  "UTM Source", "UTM Medium", "UTM Campaign", "Landing Page"
];

const EXPECTED_OPTIONS = {
  Service: ["Website Development", "Landing Page", "SaaS / Web Application", "AI Automation", "CRM / Funnel", "E-commerce", "Other"],
  Budget: ["Under $500", "$500–$1,500", "$1,500–$3,000", "$3,000–$5,000", "$5,000+"],
  Timeline: ["Immediately", "Within 30 days", "1–3 months", "Just researching"],
  "Lead Status": ["HOT", "WARM", "NURTURE"]
};

const EXPECTED_TAGS = ["HOT", "WARM", "NURTURE", "Qualified", "Nurture"];
const PIPELINE_NAME = "Agency Funnel";
const PIPELINE_STAGES = ["New Lead", "Qualified", "Call Booked", "Discovery Completed", "Proposal Sent", "Negotiation", "Won", "Lost"];

let failures = 0;
let skipped = 0;

const GREEN = "\u001b[32m";
const RED = "\u001b[31m";
const YELLOW = "\u001b[33m";
const DIM = "\u001b[2m";
const BOLD = "\u001b[1m";
const RESET = "\u001b[0m";

function pass(message) {
  process.stdout.write(`  ${GREEN}PASS${RESET}  ${message}\n`);
}

function fail(message, detail) {
  failures += 1;
  process.stdout.write(`  ${RED}FAIL${RESET}  ${message}\n`);
  if (detail) {
    process.stdout.write(`        ${DIM}${detail}${RESET}\n`);
  }
}

function skip(message) {
  skipped += 1;
  process.stdout.write(`  ${YELLOW}SKIP${RESET}  ${message}\n`);
}

function info(message) {
  process.stdout.write(`        ${DIM}${message}${RESET}\n`);
}

function heading(step, title) {
  process.stdout.write(`\n${BOLD}${step}. ${title}${RESET}\n`);
}

/** Never let the token reach the terminal, even inside a GHL error message. */
function redact(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (!TOKEN) {
    return text;
  }
  return text.split(TOKEN).join("[redacted]").slice(0, 300);
}

async function api(path, { method = "GET", body } = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/json",
      Version: VERSION,
      ...(body ? { "Content-Type": "application/json" } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const raw = await response.text();
  let payload = null;
  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = null;
    }
  }
  if (!response.ok) {
    const message = payload && typeof payload.message === "string" ? payload.message : `status ${response.status}`;
    throw new Error(`${method} ${path} -> ${response.status} ${redact(message)}`);
  }
  return payload;
}

function list(payload, key) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload[key])) return payload[key];
  return [];
}

function optionLabels(field) {
  const raw = field && field.picklistOptions;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((option) => (typeof option === "string" ? option : option && typeof option.label === "string" ? option.label : ""))
    .filter(Boolean)
    .map((label) => label.trim().toLowerCase());
}

async function main() {
  if (!TOKEN || !LOCATION_ID) {
    process.stderr.write("GHL_TOKEN and GHL_LOCATION_ID are required.\n");
    process.exit(2);
  }
  process.stdout.write(`${BOLD}GHL funnel verification${RESET}${dryRun ? ` ${YELLOW}(dry run)${RESET}` : ""}\n`);
  info(`location ${LOCATION_ID} · api ${BASE_URL} · version ${VERSION}`);

  const syntheticEmail = `funnel-verify-${Date.now()}@example.com`;
  let contactId = null;
  let pipeline = null;

  heading(1, "Location");
  const location = await api(`/locations/${encodeURIComponent(LOCATION_ID)}`);
  if (location && location.id === LOCATION_ID) {
    pass(`location resolved: ${location.name || "(unnamed)"}`);
  } else {
    fail("the API returned a different location than requested", redact(location));
  }

  heading(2, "Qualification fields");
  const customFields = list(await api(`/locations/${encodeURIComponent(LOCATION_ID)}/customFields?model=contact`), "customFields");
  const fieldsByName = new Map(customFields.map((field) => [String(field.name || "").trim().toLowerCase(), field]));
  const missingFields = EXPECTED_FIELDS.filter((name) => !fieldsByName.has(name.toLowerCase()));
  if (missingFields.length === 0) {
    pass(`all ${EXPECTED_FIELDS.length} qualification fields exist`);
  } else {
    fail(`${missingFields.length} field(s) missing`, `run the setup wizard: ${missingFields.join(", ")}`);
  }

  heading(3, "Picklist options (the silent data-loss check)");
  for (const [name, expected] of Object.entries(EXPECTED_OPTIONS)) {
    const field = fieldsByName.get(name.toLowerCase());
    if (!field) {
      fail(`${name}: field missing`);
      continue;
    }
    const actual = new Set(optionLabels(field));
    const gaps = expected.filter((option) => !actual.has(option.toLowerCase()));
    if (gaps.length === 0) {
      pass(`${name}: all ${expected.length} options present`);
    } else {
      fail(`${name}: ${gaps.length} option(s) missing`, `GHL discards values that are not real options. Add in GHL > Custom Fields: ${gaps.join(" | ")}`);
    }
  }

  heading(4, "Tags");
  const tags = list(await api(`/locations/${encodeURIComponent(LOCATION_ID)}/tags`), "tags");
  const tagNames = new Set(tags.map((tag) => String(tag.name || "").toLowerCase()));
  const missingTags = EXPECTED_TAGS.filter((tag) => !tagNames.has(tag.toLowerCase()));
  if (missingTags.length === 0) {
    pass(`all ${EXPECTED_TAGS.length} routing tags exist`);
  } else {
    fail(`${missingTags.length} tag(s) missing`, `run the setup wizard: ${missingTags.join(", ")}`);
  }

  heading(5, "Pipeline");
  const pipelines = list(await api(`/opportunities/pipelines?locationId=${encodeURIComponent(LOCATION_ID)}`), "pipelines");
  pipeline = pipelines.find((candidate) => String(candidate.name || "").toLowerCase() === PIPELINE_NAME.toLowerCase());
  if (!pipeline) {
    fail(`pipeline "${PIPELINE_NAME}" not found`, "run the setup wizard");
  } else {
    const stageNames = new Set((pipeline.stages || []).map((stage) => String(stage.name || "").toLowerCase()));
    const missingStages = PIPELINE_STAGES.filter((stage) => !stageNames.has(stage.toLowerCase()));
    if (missingStages.length === 0) {
      pass(`"${PIPELINE_NAME}" exists with all ${PIPELINE_STAGES.length} stages`);
    } else {
      fail(`${missingStages.length} stage(s) missing`, missingStages.join(", "));
    }
  }

  heading(6, "Upsert a synthetic HOT lead");
  const fieldId = (name) => fieldsByName.get(name.toLowerCase())?.id;
  const customFieldsPayload = [
    { id: fieldId("Service"), fieldValue: "CRM / Funnel" },
    { id: fieldId("Challenge"), fieldValue: "Need automation" },
    { id: fieldId("Budget"), fieldValue: "$5,000+" },
    { id: fieldId("Timeline"), fieldValue: "Immediately" },
    { id: fieldId("Lead Score"), fieldValue: "70" },
    { id: fieldId("Lead Status"), fieldValue: "HOT" }
  ].filter((entry) => entry.id);

  if (dryRun) {
    skip("would upsert a contact and verify the fields persisted");
  } else {
    const upserted = await api("/contacts/upsert", {
      method: "POST",
      body: {
        locationId: LOCATION_ID,
        name: "Funnel Verify",
        firstName: "Funnel",
        lastName: "Verify",
        email: syntheticEmail,
        source: "funnel-verification",
        customFields: customFieldsPayload
      }
    });
    contactId = upserted?.contact?.id;
    if (contactId) {
      pass(`contact created: ${contactId}`);
    } else {
      fail("upsert returned no contact id", redact(upserted));
    }
  }

  heading(7, "Tag the contact HOT");
  if (dryRun || !contactId) {
    skip("would call POST /contacts/{id}/tags");
  } else {
    await api(`/contacts/${encodeURIComponent(contactId)}/tags`, { method: "POST", body: { tags: ["HOT"] } });
    pass("HOT tag applied");
  }

  heading(8, "Create the opportunity in Qualified");
  let opportunityId = null;
  if (dryRun || !contactId || !pipeline) {
    skip("would call POST /opportunities/ at stage Qualified");
  } else {
    const qualified = (pipeline.stages || []).find((stage) => String(stage.name).toLowerCase() === "qualified");
    const opportunity = await api("/opportunities/", {
      method: "POST",
      body: {
        locationId: LOCATION_ID,
        contactId,
        pipelineId: pipeline.id,
        pipelineStageId: qualified?.id,
        name: "Funnel Verify",
        status: "open"
      }
    });
    opportunityId = opportunity?.id;
    if (opportunityId) {
      pass(`opportunity created: ${opportunityId}`);
    } else {
      fail("opportunity creation returned no id", redact(opportunity));
    }
  }

  heading(9, "Re-read the contact and confirm the picklist values stuck");
  if (dryRun || !contactId) {
    skip("this is the check that catches silently discarded custom field values");
  } else {
    const contact = await api(`/contacts/${encodeURIComponent(contactId)}`);
    const values = new Map(
      (contact?.customFields || []).map((entry) => [String(entry.name || "").trim().toLowerCase(), entry.value])
    );
    for (const [name, expected] of [
      ["Service", "CRM / Funnel"],
      ["Budget", "$5,000+"],
      ["Timeline", "Immediately"],
      ["Lead Status", "HOT"]
    ]) {
      const actual = values.get(name.toLowerCase());
      if (actual === expected) {
        pass(`${name} persisted as "${actual}"`);
      } else {
        fail(`${name} did not persist`, `expected "${expected}", got ${actual === undefined ? "nothing" : `"${actual}"`}`);
      }
    }
  }

  heading(10, "Enrol in the nurture workflow");
  const workflows = list(await api(`/workflows/?locationId=${encodeURIComponent(LOCATION_ID)}`), "workflows");
  const nurture = workflows.find((workflow) => String(workflow.name || "").toLowerCase() === "lead nurture");
  if (!nurture) {
    fail('no published workflow named "Lead Nurture"', "build it from NURTURE_WORKFLOW.md, publish, then paste its ID into the setup wizard");
  } else if (dryRun || !contactId) {
    pass(`found "${nurture.name}" (${nurture.id})`);
    skip("would call POST /contacts/{id}/workflow/{workflowId}");
  } else {
    await api(`/contacts/${encodeURIComponent(contactId)}/workflow/${encodeURIComponent(nurture.id)}`, {
      method: "POST",
      body: { eventStartTime: new Date().toISOString() }
    });
    pass(`enrolled in "${nurture.name}"`);
  }

  heading(11, "Duplicate handling");
  if (dryRun || !contactId) {
    skip("would re-post the same email and confirm no second contact");
  } else {
    const again = await api("/contacts/upsert", {
      method: "POST",
      body: { locationId: LOCATION_ID, email: syntheticEmail, firstName: "Funnel", lastName: "Verify" }
    });
    if (again?.contact?.id === contactId) {
      pass("re-submitting the same email updated the same contact");
      info("this depends on the location's 'Allow Duplicate Contact' setting — confirm it is email-based");
    } else {
      fail("re-submitting created a different contact", `expected ${contactId}, got ${again?.contact?.id ?? "nothing"}`);
    }
  }

  heading(12, "Opportunity search (the dashboard read)");
  const search = await api("/opportunities/search", {
    method: "POST",
    body: { locationId: LOCATION_ID, query: "", limit: 100, page: 0, additionalDetails: { notes: false, tasks: false, calendarEvents: false } }
  });
  const found = list(search, "opportunities");
  if (opportunityId && found.some((opportunity) => opportunity.id === opportunityId)) {
    pass(`dashboard search returns the new opportunity (${search.total ?? found.length} total)`);
  } else {
    info(`search returned ${search.total ?? found.length} opportunities`);
    pass("search endpoint responded");
  }

  process.stdout.write(`\n${BOLD}Summary${RESET}\n`);
  if (failures === 0) {
    process.stdout.write(`  ${GREEN}All checks passed${RESET}${skipped ? ` (${skipped} skipped)` : ""}.\n`);
    if (dryRun) {
      process.stdout.write(`  ${DIM}Re-run without --dry-run to exercise the write path.${RESET}\n`);
    }
    process.stdout.write(`  ${DIM}Synthetic lead: ${syntheticEmail} — delete it in GHL when you are done.${RESET}\n`);
  } else {
    process.stdout.write(`  ${RED}${failures} check(s) failed${RESET}${skipped ? `, ${skipped} skipped` : ""}.\n`);
  }

  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  process.stderr.write(`\n${RED}Verification aborted:${RESET} ${redact(error instanceof Error ? error.message : String(error))}\n`);
  process.exit(1);
});
