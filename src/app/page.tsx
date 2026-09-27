import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { SiteHeader } from "@/components/site-header";
import { getPublicConfig } from "@/lib/setup";

export const dynamic = "force-dynamic";

const capabilities = [
  {
    title: "Conversion-first websites",
    copy: "Clear positioning, focused pages, and a qualification path that gives good-fit buyers a reason to continue.",
    tone: "dark"
  },
  {
    title: "Lead systems that follow through",
    copy: "Every form, follow-up, and handoff is designed around the next useful action.",
    tone: "accent"
  },
  {
    title: "A calmer pipeline",
    copy: "Your CRM becomes the place where context lives, not another place to manually copy updates into.",
    tone: "mist"
  }
];

export default async function HomePage() {
  const config = await getPublicConfig();

  return (
    <div className="page-shell">
      <SiteHeader />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <span className="eyebrow">Digital growth systems</span>
              <h1 className="hero-title">Make demand feel <em>predictable.</em></h1>
              <p className="hero-subtitle">A conversion-focused website and GHL-native lead system for teams ready to turn attention into conversations.</p>
              <div className="hero-actions">
                <Link className="button button-primary" href="/apply">Start a project <ArrowUpRight size={17} weight="bold" /></Link>
                <Link className="button button-secondary" href="#system">See the system <ArrowRight size={17} /></Link>
              </div>
              <div className="hero-note">
                <span className="status-dot" />
                {config.connected ? `${config.locationName ?? "Your GHL location"} is connected` : "Built for a clean handover to your GHL account"}
              </div>
            </div>
            <div className="hero-visual" aria-label="A focused team working together">
              <div className="hero-index">NS / 01</div>
              <div className="hero-image-frame">
                <Image
                  className="hero-image"
                  src="https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1400&q=85"
                  alt="A team reviewing work around a table"
                  fill
                  priority
                  sizes="(max-width: 900px) 100vw, 50vw"
                />
                <div className="hero-image-overlay" />
              </div>
              <div className="hero-visual-label">
                <span className="eyebrow">The outcome</span>
                <strong>Less friction.<br />More signal.</strong>
                <span>From first click to booked call.</span>
              </div>
            </div>
          </div>
        </section>

        <div className="marquee" aria-label="The Moose Funnel System capabilities">
          <div className="marquee-track">
            <span>Positioning</span><span>·</span><span>Websites</span><span>·</span><span>Lead qualification</span><span>·</span><span>Follow-up</span><span>·</span><span>Pipeline clarity</span><span>·</span>
            <span>Positioning</span><span>·</span><span>Websites</span><span>·</span><span>Lead qualification</span><span>·</span><span>Follow-up</span><span>·</span><span>Pipeline clarity</span><span>·</span>
            <span>Positioning</span><span>·</span><span>Websites</span><span>·</span><span>Lead qualification</span><span>·</span><span>Follow-up</span><span>·</span><span>Pipeline clarity</span><span>·</span>
          </div>
        </div>

        <section className="section" id="approach">
          <div className="container split-intro">
            <h2>Good work should make the next step obvious.</h2>
            <div>
              <div className="split-intro-copy">
                <p>Most teams do not need more noise. They need a clearer story, a better question, and a system that remembers what happened.</p>
                <p>We connect the front-end experience to the GHL workflow behind it, so the momentum survives every handoff.</p>
              </div>
              <div className="number-list">
                <div className="number-row">
                  <strong>01 /</strong>
                  <h3>Position the signal</h3>
                  <p>Say what you do, who it is for, and why now without making people decode a feature list.</p>
                </div>
                <div className="number-row">
                  <strong>02 /</strong>
                  <h3>Qualify with care</h3>
                  <p>Ask only what helps you route the conversation. The rest belongs in the follow-up, not the first click.</p>
                </div>
                <div className="number-row">
                  <strong>03 /</strong>
                  <h3>Keep the promise</h3>
                  <p>Every lead gets a useful next step, a visible owner, and a reason to come back to you.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section section-dark" id="system">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">One connected path</span>
              <h2>From first click to booked call.</h2>
              <p>The website earns attention. GHL carries the context. Your team gets to focus on the conversation that matters.</p>
            </div>
            <div className="flow-grid">
              <div className="flow-step">
                <span className="flow-step-number">01</span>
                <h3>Capture</h3>
                <p>A focused form turns intent into a useful brief, not a pile of unanswered data.</p>
              </div>
              <div className="flow-step">
                <span className="flow-step-number">02</span>
                <h3>Qualify</h3>
                <p>Fields, scoring, and tags make the right lead visible at the right moment.</p>
              </div>
              <div className="flow-step">
                <span className="flow-step-number">03</span>
                <h3>Follow up</h3>
                <p>Native email and calendar paths give every branch a calm, consistent next step.</p>
              </div>
              <div className="flow-step">
                <span className="flow-step-number">04</span>
                <h3>Move forward</h3>
                <p>Opportunities and appointments keep the full story in one place.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="work">
          <div className="container">
            <div className="section-heading">
              <span className="eyebrow">The difference</span>
              <h2>Less theatre. More operating system.</h2>
              <p>The Moose Funnel System pairs a sharper front door with the infrastructure that makes good follow-up repeatable.</p>
            </div>
            <div className="bento-grid">
              {capabilities.map((capability) => (
                <article className={`bento-cell bento-cell-${capability.tone}`} key={capability.title}>
                  {capability.tone === "dark" ? <div className="bento-orbit" /> : null}
                  <h3>{capability.title}</h3>
                  <p>{capability.copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 36 }}>
          <div className="container quote-layout">
            <div className="quote-mark">“</div>
            <div>
              <p className="quote-text">The best funnel is the one that makes the right next step feel obvious to everyone involved.</p>
              <p className="quote-attribution">A simple operating principle for every build.</p>
            </div>
          </div>
        </section>

        <section className="section" style={{ paddingTop: 36 }}>
          <div className="container">
            <div className="cta-panel">
              <div>
                <span className="eyebrow">Have a project in mind?</span>
                <h2>Let’s make the path clearer.</h2>
                <p>Tell us where the journey gets stuck. We’ll help you build the system around the answer.</p>
              </div>
              <Link className="button button-accent" href="/apply">Start a project <ArrowUpRight size={17} weight="bold" /></Link>
            </div>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="container footer-inner">
          <span className="footer-meta">© {new Date().getFullYear()} The Moose Funnel System / 01</span>
          <div className="footer-links">
            <Link href="/apply">Start a project</Link>
            <Link href="/book">Book a call</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
