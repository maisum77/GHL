const requiredProductionKeys = [
  "DATABASE_URL",
  "SETUP_ACCESS_CODE",
  "SESSION_SECRET",
  "CREDENTIAL_ENCRYPTION_KEY"
] as const;

export const appConfig = {
  databaseUrl: process.env.DATABASE_URL ?? "",
  setupAccessCode: process.env.SETUP_ACCESS_CODE ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY ?? "",
  ghlBaseUrl: process.env.GHL_API_BASE_URL ?? "https://services.leadconnectorhq.com",
  ghlApiVersion: process.env.GHL_API_VERSION ?? "v3",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"
};

export function hasDatabase(): boolean {
  return Boolean(appConfig.databaseUrl);
}

/**
 * The GHL token is encrypted with AES-256-GCM, so the key must be real key material. A
 * short passphrase would otherwise be stretched into a 32-byte key by a plain hash, which
 * is not the guarantee the handover documentation claims.
 */
export function isStrongEncryptionKey(value: string): boolean {
  const candidate = value.trim();
  if (/^[0-9a-f]{64}$/i.test(candidate)) {
    return true;
  }
  if (candidate.length < 40) {
    return false;
  }
  try {
    return Buffer.from(candidate, "base64").length === 32;
  } catch {
    return false;
  }
}

export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const missing = requiredProductionKeys.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing production configuration: ${missing.join(", ")}`);
  }

  if (!isStrongEncryptionKey(appConfig.credentialEncryptionKey)) {
    throw new Error(
      "CREDENTIAL_ENCRYPTION_KEY must be 64 hex characters or a base64 string decoding to exactly 32 bytes. Generate one with: openssl rand -hex 32"
    );
  }
}

export function isLocalMode(): boolean {
  return process.env.NODE_ENV !== "production";
}
