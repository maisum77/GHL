import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from "node:crypto";
import { appConfig, isStrongEncryptionKey } from "./config";

/**
 * Derives the 32-byte AES key. In production the configured key must already be real key
 * material, so a weak value is rejected rather than silently hashed into something that
 * only looks like a 256-bit key. Local development keeps the hashed fallback so the app
 * runs with no secrets at all.
 */
function encryptionKey(): Buffer {
  const value = appConfig.credentialEncryptionKey;
  if (!value) {
    return createHash("sha256").update(appConfig.sessionSecret || "local-development-key").digest();
  }
  if (isStrongEncryptionKey(value)) {
    const candidate = value.trim();
    if (/^[0-9a-f]{64}$/i.test(candidate)) {
      return Buffer.from(candidate, "hex");
    }
    return Buffer.from(candidate, "base64");
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("CREDENTIAL_ENCRYPTION_KEY is not valid key material. Use 64 hex characters or a base64 string decoding to 32 bytes.");
  }
  return createHash("sha256").update(value).digest();
}

export function encryptSecret(value: string, associatedData: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(associatedData));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptSecret(payload: string, associatedData: string): string {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted credential payload");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAAD(Buffer.from(associatedData));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function fingerprint(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function sign(value: string): string {
  return createHmac("sha256", appConfig.sessionSecret || "local-session-secret").update(value).digest("base64url");
}

export function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}
