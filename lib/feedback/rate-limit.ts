import crypto from "node:crypto";

export const RATE_LIMIT_MAX = 10;
export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
export const RATE_EVENT_TTL_MS = 24 * 60 * 60 * 1000;
export const PRUNE_SAMPLE_RATE = 0.05;

export function hashKey(value: string, salt: string): string {
  return crypto.createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

/**
 * Pure decision function: given counts already queried for the current window,
 * decide whether the request should be allowed. Kept separate from any I/O
 * so it can be unit tested with injected counts and a fixed clock.
 */
export function isRateLimited(ipCount: number, clientCount: number): boolean {
  return ipCount >= RATE_LIMIT_MAX || clientCount >= RATE_LIMIT_MAX;
}

export function shouldPrune(random: () => number = Math.random): boolean {
  return random() < PRUNE_SAMPLE_RATE;
}

export function windowStart(now: Date): Date {
  return new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);
}

export function pruneCutoff(now: Date): Date {
  return new Date(now.getTime() - RATE_EVENT_TTL_MS);
}
