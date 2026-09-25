import { SiteHeader } from "@/components/site-header";
import { DashboardClient } from "@/components/dashboard-client";

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
