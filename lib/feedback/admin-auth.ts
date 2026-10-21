import crypto from "node:crypto";

const COOKIE_NAME = "hush_admin_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function checkPassword(candidate: string, expected: string): boolean {
  if (!expected) return false;
  return constantTimeEqual(candidate, expected);
}

export function signSessionToken(secret: string, issuedAt: number = Date.now()): string {
  const payload = `${issuedAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${hmac}`;
}

export function verifySessionToken(token: string | undefined, secret: string): boolean {
  if (!token) return false;
  const [payload, hmac] = token.split(".");
  if (!payload || !hmac) return false;
  const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  if (!constantTimeEqual(hmac, expectedHmac)) return false;
  const issuedAt = Number(payload);
  if (!Number.isFinite(issuedAt)) return false;
  const ageSeconds = (Date.now() - issuedAt) / 1000;
  return ageSeconds >= 0 && ageSeconds <= SESSION_MAX_AGE_SECONDS;
}

export function checkBearerToken(authHeader: string | null, expected: string): boolean {
  if (!authHeader || !expected) return false;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return false;
  return constantTimeEqual(match[1], expected);
}

export { COOKIE_NAME, SESSION_MAX_AGE_SECONDS };
