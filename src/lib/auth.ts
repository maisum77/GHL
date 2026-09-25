import { NextRequest } from "next/server";
import { appConfig, isLocalMode } from "./config";
import { safeEqual, sign } from "./crypto";

export const setupSessionCookie = "ghl_setup_session";
const sessionLifetimeSeconds = 60 * 60 * 8;

export function setupAccessCodeIsValid(value: string): boolean {
  if (!appConfig.setupAccessCode) {
    return isLocalMode();
  }
  return safeEqual(value, appConfig.setupAccessCode);
}

export function createSessionValue(): string {
  const expiresAt = Math.floor(Date.now() / 1000) + sessionLifetimeSeconds;
  const payload = String(expiresAt);
  return `${payload}.${sign(payload)}`;
}

export function hasValidSession(request: NextRequest): boolean {
  const value = request.cookies.get(setupSessionCookie)?.value;
  if (!value) {
    return false;
  }

  const [expiresAt, signature] = value.split(".");
  if (!expiresAt || !signature || Number(expiresAt) < Math.floor(Date.now() / 1000)) {
    return false;
  }

  return safeEqual(signature, sign(expiresAt));
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: sessionLifetimeSeconds
};
