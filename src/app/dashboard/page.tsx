import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { DashboardClient } from "@/components/dashboard-client";

/**
 * The page is a client shell whose data comes from an authenticated API route, so nothing
 * sensitive renders without a session. It is still a private surface and should not be
 * indexed or crawled.
 */
export const metadata: Metadata = {
  title: "Opportunity dashboard — The Moose Funnel System",
  robots: { index: false, follow: false }
};

export default function DashboardPage() {
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="dashboard-shell">
        <section className="container">
          <div className="page-intro">
            <span className="eyebrow">Private workspace</span>
            <h1>Keep the signal visible.</h1>
            <p>A small, read-only view of the opportunities connected to your GHL location.</p>
          </div>
          <DashboardClient />
        </section>
      </main>
    </div>
  );
}
