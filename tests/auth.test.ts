import { describe, expect, it } from "vitest";
import { createSessionValue, hasValidSession, setupAccessCodeIsValid, setupSessionCookie } from "@/lib/auth";
import { allowLeadSubmission, allowSetupAttempt, clientKeyFrom } from "@/lib/rate-limit";
import { redactSecrets } from "@/lib/redact";
import { NextRequest } from "next/server";

describe("setup access code", () => {
  it("accepts the configured code and rejects anything else", () => {
    expect(setupAccessCodeIsValid("test-setup-code")).toBe(true);
    expect(setupAccessCodeIsValid("wrong-code")).toBe(false);
    expect(setupAccessCodeIsValid("")).toBe(false);
  });
});

describe("setup session", () => {
  function requestWithCookie(value?: string) {
    const request = new NextRequest("https://funnel.test/api/dashboard");
    if (value) {
      request.cookies.set(setupSessionCookie, value);
    }
    return request;
  }

  it("accepts a freshly signed session", () => {
    expect(hasValidSession(requestWithCookie(createSessionValue()))).toBe(true);
  });

  it("rejects a missing cookie", () => {
    expect(hasValidSession(requestWithCookie())).toBe(false);
  });

  it("rejects a tampered expiry", () => {
    const [, signature] = createSessionValue().split(".");
    // Extending the lifetime by hand must not survive verification.
    const future = String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365);
    expect(hasValidSession(requestWithCookie(`${future}.${signature}`))).toBe(false);
  });

  it("rejects a malformed value", () => {
    expect(hasValidSession(requestWithCookie("nonsense"))).toBe(false);
    expect(hasValidSession(requestWithCookie("123.abc.def"))).toBe(false);
  });

  it("rejects an expired session", () => {
    const past = String(Math.floor(Date.now() / 1000) - 60);
    const signed = createSessionValue();
    expect(hasValidSession(requestWithCookie(`${past}.${signed.split(".")[1]}`))).toBe(false);
  });
});

describe("rate limiting", () => {
  it("blocks setup attempts past the limit and resets by key", () => {
    const key = `setup-test-${Math.random()}`;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(allowSetupAttempt(key)).toBe(true);
    }
    expect(allowSetupAttempt(key)).toBe(false);
    // A different client still has its own allowance.
    expect(allowSetupAttempt(`${key}-other`)).toBe(true);
  });

  it("applies a separate allowance to lead submissions", () => {
    const key = `lead-test-${Math.random()}`;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      expect(allowLeadSubmission(key)).toBe(true);
    }
    expect(allowLeadSubmission(key)).toBe(false);
  });

  it("does not let lead traffic exhaust the setup allowance", () => {
    const host = `shared-${Math.random()}`;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      allowLeadSubmission(host);
    }
    expect(allowSetupAttempt(host)).toBe(true);
  });
});

describe("clientKeyFrom", () => {
  const build = (headers: Record<string, string>) => new NextRequest("https://funnel.test/api/leads", { headers });

  it("takes the first forwarded address", () => {
    expect(clientKeyFrom(build({ "x-forwarded-for": "203.0.113.5, 70.41.3.18" }))).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip", () => {
    expect(clientKeyFrom(build({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
  });

  it("buckets unknown callers together rather than failing open", () => {
    expect(clientKeyFrom(build({}))).toBe("unknown");
  });
});

describe("redactSecrets", () => {
  it("removes every supplied secret", () => {
    const message = "token super-secret-token-value leaked and another-secret-value too";
    expect(redactSecrets(message, ["super-secret-token-value", "another-secret-value"])).toBe(
      "token [redacted] leaked and [redacted] too"
    );
  });

  it("caps the message length", () => {
    expect(redactSecrets("x".repeat(500), [])).toHaveLength(180);
    expect(redactSecrets("x".repeat(500), [], 20)).toHaveLength(20);
  });

  it("ignores short or absent secrets so it cannot blank the message", () => {
    expect(redactSecrets("a normal error", [undefined, ""])).toBe("a normal error");
    // A very short "secret" would match ordinary words and shred the message.
    expect(redactSecrets("a normal error", ["a"])).toBe("a normal error");
  });
});
