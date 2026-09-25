"use client";

import { ArrowClockwise, ArrowUpRight, CircleNotch, WarningCircle } from "@phosphor-icons/react";
import Link from "next/link";
import { useEffect, useState } from "react";

type Opportunity = {
  id?: string;
  name?: string;
  status?: string;
  pipelineStageName?: string;
};

type DashboardData = {
  connected: boolean;
  locationName?: string;
  leads: number;
  opportunities: Opportunity[];
  error?: string;
};

export function DashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/dashboard", { cache: "no-store" })
      .then(async (response) => ({ status: response.status, body: await response.json() }))
      .then(({ status, body }) => {
        if (!active) {
          return;
        }
        if (status === 401) {
          setUnauthorized(true);
        } else {
          setData(body as DashboardData);
        }
        setLoading(false);
      })
      .catch(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function refresh() {
    setLoading(true);
    setUnauthorized(false);
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (response.status === 401) {
      setUnauthorized(true);
      setLoading(false);
      return;
    }
    setData(await response.json());
    setLoading(false);
  }

  if (loading) {
    return <div className="dashboard-card"><CircleNotch size={20} className="spin" /> Loading your GHL snapshot…</div>;
  }

  if (unauthorized) {
    return (
      <div className="dashboard-card success-panel">
        <div>
          <div className="success-icon"><ArrowUpRight size={26} /></div>
          <h2>Private dashboard</h2>
          <p>Complete the setup wizard first. The dashboard uses the same secure session and never stores lead data in the app database.</p>
          <Link className="button button-primary" href="/setup">Open setup <ArrowUpRight size={17} /></Link>
        </div>
      </div>
    );
  }

  if (!data?.connected) {
    return (
      <div className="dashboard-card">
        <h2>No GHL location connected</h2>
        <p className="empty-state">Run the setup wizard to bind this deployment to the client location.</p>
        <Link className="button button-primary" href="/setup">Connect GHL <ArrowUpRight size={17} /></Link>
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <div className="dashboard-card dashboard-card-dark">
        <h2>Pipeline snapshot</h2>
        <p className="metric-value">{data.leads}</p>
        <p className="metric-label">Opportunities visible in {data.locationName ?? "the connected location"}</p>
        {data.error ? <p className="form-error" style={{ marginTop: 22 }}><WarningCircle size={15} /> {data.error}</p> : null}
      </div>
      <div className="dashboard-card">
        <h2>Recent opportunities</h2>
        {data.opportunities.length === 0 ? (
          <p className="empty-state">No opportunities yet. Submit a test lead through the connected GHL form to populate this view.</p>
        ) : (
          <div className="opportunity-list">
            {data.opportunities.map((opportunity, index) => (
              <div className="opportunity-row" key={opportunity.id ?? index}>
                <div><strong>{opportunity.name ?? "Untitled opportunity"}</strong><span>{opportunity.pipelineStageName ?? "Stage not mapped"}</span></div>
                <span className="opportunity-status">{opportunity.status ?? "open"}</span>
              </div>
            ))}
          </div>
        )}
        <div className="dashboard-actions">
          <button className="button button-secondary" type="button" onClick={() => void refresh()}><ArrowClockwise size={16} /> Refresh</button>
          <Link className="button button-quiet" href="/setup">Review setup <ArrowUpRight size={16} /></Link>
        </div>
      </div>
    </div>
  );
}
