"use client";

import { List, X } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";

export function SiteHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand" href="/" onClick={() => setOpen(false)}>
          <span className="brand-mark">M</span>
          <span>Moose / 01</span>
        </Link>
        <nav className="header-nav" aria-label="Main navigation">
          <Link href="/#approach">Approach</Link>
          <Link href="/#system">System</Link>
          <Link href="/#work">Selected work</Link>
        </nav>
        <div className="header-actions">
          <Link className="button button-primary" href="/apply">Start a project</Link>
          <button
            className="mobile-menu-button"
            type="button"
            aria-label={open ? "Close navigation" : "Open navigation"}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={22} weight="bold" /> : <List size={22} weight="bold" />}
          </button>
        </div>
      </div>
      {open ? (
        <nav className="container mobile-nav" aria-label="Mobile navigation">
          <Link href="/#approach" onClick={() => setOpen(false)}>Approach</Link>
          <Link href="/#system" onClick={() => setOpen(false)}>System</Link>
          <Link href="/#work" onClick={() => setOpen(false)}>Selected work</Link>
          <Link href="/apply" onClick={() => setOpen(false)}>Start a project</Link>
        </nav>
      ) : null}
    </header>
  );
}
