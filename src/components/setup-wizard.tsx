"use client";

import { ArrowRight, CircleNotch, LockKey, ShieldCheck } from "@phosphor-icons/react";
import { FormEvent, useState } from "react";
import { SetupResultPanel, type SetupResult } from "@/components/setup-result";

export function SetupWizard() {
  const [state, setState] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [error, setError] = useState("");
  const [result, setResult] = useState<SetupResult | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/setup/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessCode: String(form.get("accessCode") ?? ""),
        token: String(form.get("token") ?? ""),
        locationId: String(form.get("locationId") ?? ""),
        formUrl: String(form.get("formUrl") ?? ""),
        bookingUrl: String(form.get("bookingUrl") ?? ""),
        nurtureWorkflowId: String(form.get("nurtureWorkflowId") ?? ""),
        nurtureTrigger: String(form.get("nurtureTrigger") ?? "enroll"),
        calendarHostConnected: String(form.get("calendarHostConnected") ?? "no"),
        calendarHostUserId: String(form.get("calendarHostUserId") ?? "")
      })
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Setup could not be completed");
      setState("error");
      return;
    }
    setResult(data);
    setState("success");
    event.currentTarget.reset();
  }

  if (state === "success" && result) {
    return <div className="setup-card"><SetupResultPanel result={result} /></div>;
  }

  return (
    <form className="setup-card" onSubmit={submit}>
      <h2>Connect your location</h2>
      <p>We validate the token, bind one GHL location, and create only the resources that are safe to add automatically.</p>
      <div className="setup-field">
        <label htmlFor="accessCode">Setup access code</label>
        <input id="accessCode" name="accessCode" type="password" autoComplete="one-time-code" required placeholder="Provided in your handover notes" />
        <small>This protects the first-run route. It is not your GHL password.</small>
      </div>
      <div className="setup-field">
        <label htmlFor="token">GHL Private Integration token</label>
        <input id="token" name="token" type="password" autoComplete="off" required placeholder="Paste the location-scoped token" />
        <small>Use a Private Integration token, not a legacy API key. The token is encrypted server-side and never returned to the browser.</small>
      </div>
      <div className="setup-field">
        <label htmlFor="locationId">GHL Location ID</label>
        <input id="locationId" name="locationId" required placeholder="e.g. ve9EPM428h8vShlRW1KT" />
        <small>Find this in the target subaccount under Settings → Business Profile.</small>
      </div>
      <div className="setup-field">
        <label htmlFor="formUrl">Qualification form URL <span className="form-help">(optional now)</span></label>
        <input id="formUrl" name="formUrl" type="url" placeholder="https://msgsndr.com/..." />
      </div>
      <div className="setup-field">
        <label htmlFor="bookingUrl">Discovery booking URL <span className="form-help">(optional now)</span></label>
        <input id="bookingUrl" name="bookingUrl" type="url" placeholder="https://msgsndr.com/calendar/..." />
        <small>We create the 30-minute Discovery Call calendar for you. Paste its public booking URL once GHL shows it.</small>
      </div>
      <div className="setup-field">
        <label htmlFor="nurtureWorkflowId">Nurture workflow ID <span className="form-help">(optional now)</span></label>
        <input id="nurtureWorkflowId" name="nurtureWorkflowId" placeholder="e.g. f5a2ab74-4c1c-4ede-9c43-2ef1e01e0b38" />
        <small>Build the sequence from NURTURE_WORKFLOW.md, publish it, then paste its ID.</small>
      </div>
      <div className="setup-field">
        <label htmlFor="nurtureTrigger">How does the workflow start?</label>
        <select id="nurtureTrigger" name="nurtureTrigger" defaultValue="enroll">
          <option value="enroll">Enrol every lead (workflow branches on Lead Status)</option>
          <option value="tag">Contact tag triggers it (simplest to build)</option>
        </select>
        <small>
          Pick <strong>Contact tag</strong> if your workflow starts with a <code>Contact Tag</code> trigger on
          <code> HOT</code> — it needs no If/Else. Pick <strong>Enrol every lead</strong> if the workflow has no
          trigger and branches internally. GHL fires a tag-triggered workflow itself, so this app must not also
          enrol the contact or it would run twice.
        </small>
      </div>
      <div className="setup-field">
        <label htmlFor="calendarHostConnected">Has the host connected a real calendar?</label>
        <select id="calendarHostConnected" name="calendarHostConnected" defaultValue="no">
          <option value="no">Not yet</option>
          <option value="yes">Yes — Google or Outlook is connected</option>
        </select>
        <small>
          GHL does not report whether a calendar has an external account connected, so this is
          your confirmation rather than something this app can check. Until a host is connected
          the calendar only publishes default slots, which can double-book you.
          Settings &rarr; Calendars &rarr; Discovery Call &rarr; Edit &rarr; Connections.
        </small>
      </div>
      <div className="setup-field">
        <label htmlFor="calendarHostUserId">Calendar host user ID <span className="form-help">(optional)</span></label>
        <input id="calendarHostUserId" name="calendarHostUserId" placeholder="Defaults to the first user in the location" />
        <small>Whose calendar hosts the discovery calls. They still need to connect Google or Outlook for real availability.</small>
      </div>
      {state === "error" ? <p className="form-error" role="alert">{error}</p> : null}
      <div className="setup-submit">
        <small><LockKey size={14} /> Nothing is sent to the client browser after setup. GHL remains the source of truth for lead data.</small>
        <button className="button button-primary" type="submit" disabled={state === "loading"}>
          {state === "loading" ? <><CircleNotch size={17} className="spin" /> Checking GHL</> : <>Validate and connect <ArrowRight size={17} /></>}
        </button>
      </div>
      <div className="form-note"><ShieldCheck size={17} /> We request only the scopes needed to discover and provision the agreed resources.</div>
    </form>
  );
}
