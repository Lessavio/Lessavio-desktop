import { createHmac, timingSafeEqual } from "crypto";
import { Response } from "express";
import { config } from "../config";

const SESSION_COOKIE_NAME = "tutorly_session";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

interface SessionPayload {
  sub: string;
  exp: number;
}

function signature(value: string): Buffer {
  return createHmac("sha256", config.sessionSecret).update(value).digest();
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    sub: userId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encodedPayload}.${signature(encodedPayload).toString("base64url")}`;
}

export function verifySessionToken(token: string): string | undefined {
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return undefined;

  try {
    const providedSignature = Buffer.from(parts[1], "base64url");
    const expectedSignature = signature(parts[0]);
    if (
      providedSignature.length !== expectedSignature.length ||
      !timingSafeEqual(providedSignature, expectedSignature)
    ) {
      return undefined;
    }

    const parsed: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    const payload = parsed as Partial<SessionPayload>;
    if (
      typeof payload.sub !== "string" ||
      !/^\d+$/.test(payload.sub) ||
      typeof payload.exp !== "number" ||
      !Number.isInteger(payload.exp) ||
      payload.exp <= Math.floor(Date.now() / 1000)
    ) {
      return undefined;
    }
    return payload.sub;
  } catch {
    return undefined;
  }
}

export function readSessionCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const name = part.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

function cookieAttributes(maxAge: number): string {
  const secure = config.isProduction ? "; Secure" : "";
  return `HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secure}`;
}

export function setSessionCookie(res: Response, token: string): void {
  res.append(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; ${cookieAttributes(SESSION_MAX_AGE_SECONDS)}`
  );
}

export function clearSessionCookie(res: Response): void {
  res.append("Set-Cookie", `${SESSION_COOKIE_NAME}=; ${cookieAttributes(0)}`);
}
