import Link from "next/link";
import { ArrowUpRight, CalendarBlank, CheckCircle, Clock, VideoCamera } from "@phosphor-icons/react/dist/ssr";
import { SiteHeader } from "@/components/site-header";
import { getPublicConfig } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const config = await getPublicConfig();
  const hasBooking = Boolean(config.bookingUrl);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <section className="page-intro">
          <div className="container">
            <span className="eyebrow">Discovery call</span>
            <h1>Make the next conversation useful.</h1>
            <p>Choose a time that works. We will use the call to understand the problem, not to sell you a deck.</p>
          </div>
        </section>
        <section className="container booking-panel">
          <aside className="booking-card">
            <span className="eyebrow">30 minutes · focused</span>
            <h2>Bring the messy version.</h2>
            <p>You do not need a polished brief. A rough idea, a stuck funnel, or a next milestone is enough to start.</p>
            <div className="booking-details">
              <div className="booking-detail"><span>Format</span><strong>Video call</strong></div>
              <div className="booking-detail"><span>Length</span><strong>30 minutes</strong></div>
              <div className="booking-detail"><span>Afterwards</span><strong>Clear next steps</strong></div>
            </div>
          </aside>
          <div>
            {hasBooking ? (
              <div>
                <div className="form-card" style={{ padding: 0, overflow: "hidden" }}>
                  <iframe className="integration-frame" src={config.bookingUrl} title="Discovery call booking calendar" />
                </div>
                <p className="form-help" style={{ marginTop: 12 }}>The calendar did not load? <Link href={config.bookingUrl} target="_blank" rel="noreferrer">Open it in a new tab <ArrowUpRight size={14} /></Link></p>
              </div>
            ) : (
              <div className="form-card success-panel">
                <div>
                  <div className="success-icon"><CalendarBlank size={28} weight="fill" /></div>
                  <h2>Calendar connection pending.</h2>
                  <p>Once the GHL setup wizard has a booking URL, this page will show the live calendar here.</p>
                  <Link className="button button-primary" href="/apply">Send a project brief instead <ArrowUpRight size={17} /></Link>
                </div>
              </div>
            )}
            <div className="form-note"><CheckCircle size={17} /> You will receive a confirmation and reminder from the connected calendar.</div>
            <div className="form-note"><VideoCamera size={17} /> A reliable calendar connection is completed during handover.</div>
            <div className="form-note"><Clock size={17} /> Need another route? <Link href="/apply">Send a project brief instead.</Link></div>
          </div>
        </section>
      </main>
    </div>
  );
}
