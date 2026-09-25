import type { NextRequest } from "next/server";

type RateEntry = {
  count: number;
  resetAt: number;
};

type RateRule = {
  limit: number;
  windowMs: number;
};

const globalState = globalThis as typeof globalThis & {
  __ghlSetupRateLimits?: Map<string, RateEntry>;
};

const entries = globalState.__ghlSetupRateLimits ?? new Map<string, RateEntry>();
globalState.__ghlSetupRateLimits = entries;

// Credential-guessing protection. Tight, because a valid code is worth protecting.
const setupRule: RateRule = { limit: 5, windowMs: 15 * 60 * 1000 };

// A public form that creates contacts, tags, opportunities and enrollments. Loose
// enough that a real person behind a shared NAT is never blocked.
const leadRule: RateRule = { limit: 8, windowMs: 10 * 60 * 1000 };

function allow(key: string, rule: RateRule): boolean {
  const now = Date.now();
  const current = entries.get(key);
  if (!current || current.resetAt <= now) {
    entries.set(key, { count: 1, resetAt: now + rule.windowMs });
    return true;
  }
  if (current.count >= rule.limit) {
    return false;
  }
  current.count += 1;
  return true;
}

export function allowSetupAttempt(key: string): boolean {
  return allow(`setup:${key}`, setupRule);
}

export function allowLeadSubmission(key: string): boolean {
  return allow(`lead:${key}`, leadRule);
}

/**
 * Best-effort client identity from proxy headers. On Vercel `x-forwarded-for` is set by
 * the platform; the literal "unknown" bucket means every caller shares one allowance.
 */
export function clientKeyFrom(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
