import { SiteHeader } from "@/components/site-header";
import { SetupWizard } from "@/components/setup-wizard";

export default function SetupPage() {
  return (
    <div className="page-shell">
      <SiteHeader />
      <main className="setup-shell">
        <section className="container setup-layout">
          <aside className="setup-aside">
            <span className="eyebrow">Client handover</span>
            <h1>Connect once. Run with confidence.</h1>
            <p>This setup binds the project to one GHL location, validates the connection, and safely prepares the lead system.</p>
            <div className="setup-steps">
              <div className="setup-step"><span className="setup-step-number">01</span><div><strong>Validate access</strong><span>Check the location and token before anything is saved.</span></div></div>
              <div className="setup-step"><span className="setup-step-number">02</span><div><strong>Prepare resources</strong><span>Create missing fields, tags, and the dedicated pipeline.</span></div></div>
              <div className="setup-step"><span className="setup-step-number">03</span><div><strong>Finish in GHL</strong><span>Import the form, workflows, and calendar during the one-time handover step.</span></div></div>
              <div className="setup-step"><span className="setup-step-number">04</span><div><strong>Verify and launch</strong><span>Run a real lead and booking test before marking the system ready.</span></div></div>
            </div>
          </aside>
          <SetupWizard />
        </section>
      </main>
    </div>
  );
}
