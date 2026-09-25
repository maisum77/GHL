"use client";

import { ArrowRight, CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import { FormEvent, useState } from "react";
import Link from "next/link";

const services = ["Website Development", "Landing Page", "SaaS / Web Application", "AI Automation", "CRM / Funnel", "E-commerce", "Other"];
const challenges = ["Not getting enough leads", "Website isn't converting", "Manual processes", "Need a new website", "Need automation", "Need an MVP", "Other"];
const budgets = ["Under $500", "$500–$1,500", "$1,500–$3,000", "$3,000–$5,000", "$5,000+"];
const timelines = ["Immediately", "Within 30 days", "1–3 months", "Just researching"];

export function QualificationForm({ bookingUrl }: { bookingUrl?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [demo, setDemo] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("loading");
    setMessage("");
    const form = new FormData(event.currentTarget);
    const payload = {
      name: String(form.get("name") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      company: String(form.get("company") ?? ""),
      website: String(form.get("website") ?? ""),
      service: String(form.get("service") ?? ""),
      challenge: String(form.get("challenge") ?? ""),
      budget: String(form.get("budget") ?? ""),
      timeline: String(form.get("timeline") ?? ""),
      existingWebsite: form.get("existingWebsite") === "yes",
      message: String(form.get("message") ?? ""),
      utmSource: new URLSearchParams(window.location.search).get("utm_source") ?? undefined,
      utmMedium: new URLSearchParams(window.location.search).get("utm_medium") ?? undefined,
      utmCampaign: new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined,
      landingPage: window.location.href
    };

    try {
      const response = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error ?? "We could not send your details");
      }
      setDemo(Boolean(data.demo));
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "We could not send your details");
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <div className="form-card success-panel">
        <div>
          <div className="success-icon"><CheckCircle size={28} weight="fill" /></div>
          <h2>Thanks. We’ll be in touch.</h2>
          <p>{demo ? "This is a local demo submission. Connect GHL in the setup wizard to route it to your live pipeline." : "Your details are in the right hands. We’ll follow up with a useful next step shortly."}</p>
          {bookingUrl ? <Link className="button button-primary" href="/book">Book a discovery call <ArrowRight size={17} /></Link> : null}
        </div>
      </div>
    );
  }

  return (
    <form className="form-card" onSubmit={submit}>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="name">Full name</label>
          <input id="name" name="name" autoComplete="name" required placeholder="Alex Morgan" />
        </div>
        <div className="form-field">
          <label htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" autoComplete="email" required placeholder="alex@company.com" />
        </div>
        <div className="form-field">
          <label htmlFor="phone">Phone</label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" placeholder="+1 555 000 0000" />
        </div>
        <div className="form-field">
          <label htmlFor="company">Company</label>
          <input id="company" name="company" autoComplete="organization" placeholder="Company name" />
        </div>
        <div className="form-field form-field-full">
          <label htmlFor="website">Current website</label>
          <input id="website" name="website" type="url" placeholder="https://" />
        </div>
        <div className="form-field">
          <label htmlFor="service">What can we help with?</label>
          <select id="service" name="service" defaultValue="" required>
            <option value="" disabled>Select one</option>
            {services.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="challenge">Biggest challenge right now</label>
          <select id="challenge" name="challenge" defaultValue="" required>
            <option value="" disabled>Select one</option>
            {challenges.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="budget">Approximate budget</label>
          <select id="budget" name="budget" defaultValue="" required>
            <option value="" disabled>Select one</option>
            {budgets.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="timeline">When are you looking to start?</label>
          <select id="timeline" name="timeline" defaultValue="" required>
            <option value="" disabled>Select one</option>
            {timelines.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </div>
        <div className="form-field form-field-full">
          <label htmlFor="existingWebsite">Do you already have a website?</label>
          <select id="existingWebsite" name="existingWebsite" defaultValue="" required>
            <option value="" disabled>Select one</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        <div className="form-field form-field-full">
          <label htmlFor="message">Anything else we should know?</label>
          <textarea id="message" name="message" placeholder="A little context helps us prepare." />
        </div>
      </div>
      {state === "error" ? <p className="form-error" role="alert"><WarningCircle size={16} /> {message}</p> : null}
      <div className="form-actions">
        <small>We only use these details to respond to your project request.</small>
        <button className="button button-primary" type="submit" disabled={state === "loading"}>
          {state === "loading" ? <><CircleNotch size={17} className="spin" /> Sending</> : <>Send project details <ArrowRight size={17} /></>}
        </button>
      </div>
    </form>
  );
}
