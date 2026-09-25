import { ArrowUpRight, CheckCircle, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";

export type FieldReport = {
  name: string;
  outcome: "created" | "created_missing_options" | "existing" | "failed";
  detail?: string;
};

export type SetupResult = {
  status: "connected" | "awaiting_assets" | "ready" | "degraded";
  locationId: string;
  locationName: string;
  created: string[];
  fieldReports?: FieldReport[];
  warnings: string[];
  manualSteps: string[];
  formUrl: string;
  bookingUrl: string;
  nurtureWorkflowId?: string;
  calendarId?: string;
};

const outcomeLabels: Record<FieldReport["outcome"], string> = {
  created: "Created",
  created_missing_options: "Created, options needed",
  existing: "Already existed",
  failed: "Failed"
};

export function SetupResultPanel({ result }: { result: SetupResult }) {
  const ready = result.status === "ready";
  const fieldReports = result.fieldReports ?? [];
  const attention = fieldReports.filter(
    (report) => report.outcome === "created_missing_options" || report.outcome === "failed"
  );

  return (
    <div className="setup-result">
      <div className="setup-result-header">
        <div>
          <h2>{ready ? "Your system is ready" : "GHL is connected"}</h2>
          <p>{result.locationName} · {result.locationId}</p>
        </div>
        <span className={`status-badge ${ready ? "status-badge-ready" : ""}`}>
          {ready ? <CheckCircle size={14} weight="fill" /> : <WarningCircle size={14} weight="fill" />}
          {ready ? "Ready" : "Action needed"}
        </span>
      </div>
      {result.created.length > 0 ? (
        <div>
          <p className="eyebrow">Provisioned safely</p>
          <ul className="setup-result-list">
            {result.created.map((item) => (
              <li key={item}><CheckCircle size={17} weight="fill" /> Created {item.replace(":", " · ")}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {attention.length > 0 ? (
        <div>
          <p className="eyebrow">Qualification fields needing options</p>
          <ul className="setup-result-list">
            {attention.map((report) => (
              <li key={report.name}><WarningCircle size={17} /> {report.name} — {outcomeLabels[report.outcome]}{report.detail ? `: ${report.detail}` : ""}</li>
            ))}
          </ul>
          <p className="form-help">GHL will not store a picklist value that is not a real option, so leads cannot be scored on these fields until they are set.</p>
        </div>
      ) : null}
      {result.manualSteps.length > 0 ? (
        <div>
          <p className="eyebrow">One-time GHL setup</p>
          <ul className="setup-result-list">
            {result.manualSteps.map((step) => (
              <li key={step}><CircleNotch size={17} weight="bold" /> {step}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.warnings.length > 0 ? (
        <div>
          <p className="eyebrow">Review warnings</p>
          <ul className="setup-result-list">
            {result.warnings.slice(0, 6).map((warning) => (
              <li key={warning}><WarningCircle size={17} /> {warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <div className="setup-result-actions">
        {result.formUrl ? <Link className="button button-primary" href="/apply">Open qualification form <ArrowUpRight size={16} /></Link> : null}
        {result.bookingUrl ? <Link className="button button-secondary" href="/book">Open booking page <ArrowUpRight size={16} /></Link> : null}
        <Link className="button button-quiet" href="/dashboard">View dashboard</Link>
      </div>
    </div>
  );
}
