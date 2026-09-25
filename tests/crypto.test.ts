import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, fingerprint, safeEqual } from "@/lib/crypto";

describe("credential protection", () => {
  it("round trips an encrypted secret with associated data", () => {
    const encrypted = encryptSecret("private-token", "location-123");
    expect(encrypted).not.toContain("private-token");
    expect(decryptSecret(encrypted, "location-123")).toBe("private-token");
  });

  it("rejects a credential moved to another location", () => {
    const encrypted = encryptSecret("private-token", "location-123");
    expect(() => decryptSecret(encrypted, "location-456")).toThrow();
  });

  it("creates stable non-secret fingerprints", () => {
    expect(fingerprint("token")).toBe(fingerprint("token"));
    expect(fingerprint("token")).toHaveLength(16);
  });

  it("compares values without accepting different lengths", () => {
    expect(safeEqual("same", "same")).toBe(true);
    expect(safeEqual("same", "different")).toBe(false);
  });
});
