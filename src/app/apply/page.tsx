import Link from "next/link";
import { ArrowUpRight, CheckCircle, Clock, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import { SiteHeader } from "@/components/site-header";
import { QualificationForm } from "@/components/qualification-form";
import { getPublicConfig } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function ApplyPage() {
  const config = await getPublicConfig();
  const hasGhlForm = Boolean(config.formUrl);

  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <section className="page-intro">
          <div className="container">
            <span className="eyebrow">Start a project</span>
            <h1>Tell us what needs to move.</h1>
            <p>A few focused details help us understand the opportunity before we get on a call.</p>
          </div>
        </section>
        <section className="container form-layout">
          <aside className="form-aside">
            <h2>A useful brief beats a long form.</h2>
            <p>Share the context behind the project, what is getting in the way, and what a better outcome would look like.</p>
            <div className="form-note"><Clock size={18} /> Takes about two minutes.</div>
            <div className="form-note"><ShieldCheck size={18} /> Your details are used to respond to this request.</div>
            <div className="form-note"><CheckCircle size={18} /> No obligation, no hard sell.</div>
          </aside>
          <div>
            {hasGhlForm ? (
              <div>
                <div className="form-card" style={{ padding: 0, overflow: "hidden" }}>
                  <iframe className="integration-frame" src={config.formUrl} title="Project qualification form" />
                </div>
                <p className="form-help" style={{ marginTop: 12 }}>The form did not load? <Link href={config.formUrl} target="_blank" rel="noreferrer">Open it in a new tab <ArrowUpRight size={14} /></Link></p>
              </div>
            ) : (
              <QualificationForm bookingUrl={config.bookingUrl} />
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
