import { describe, it, expect } from "vitest";
import {
  isRateLimited,
  hashKey,
  shouldPrune,
  windowStart,
  pruneCutoff,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  RATE_EVENT_TTL_MS,
} from "../rate-limit";

describe("isRateLimited", () => {
  it("allows when both counts are below the max", () => {
    expect(isRateLimited(0, 0)).toBe(false);
    expect(isRateLimited(RATE_LIMIT_MAX - 1, RATE_LIMIT_MAX - 1)).toBe(false);
  });

  it("blocks when ip count reaches the max", () => {
    expect(isRateLimited(RATE_LIMIT_MAX, 0)).toBe(true);
  });

  it("blocks when client count reaches the max", () => {
    expect(isRateLimited(0, RATE_LIMIT_MAX)).toBe(true);
  });

  it("blocks when both exceed the max", () => {
    expect(isRateLimited(RATE_LIMIT_MAX + 5, RATE_LIMIT_MAX + 5)).toBe(true);
  });
});

describe("hashKey", () => {
  it("is deterministic for the same input and salt", () => {
    expect(hashKey("1.2.3.4", "salt")).toBe(hashKey("1.2.3.4", "salt"));
  });

  it("differs for different salts", () => {
    expect(hashKey("1.2.3.4", "salt1")).not.toBe(hashKey("1.2.3.4", "salt2"));
  });

  it("differs for different inputs", () => {
    expect(hashKey("1.2.3.4", "salt")).not.toBe(hashKey("1.2.3.5", "salt"));
  });

  it("never returns the raw input", () => {
    expect(hashKey("1.2.3.4", "salt")).not.toContain("1.2.3.4");
  });
});

describe("shouldPrune", () => {
  it("returns true when random is below the sample rate", () => {
    expect(shouldPrune(() => 0.01)).toBe(true);
  });

  it("returns false when random is above the sample rate", () => {
    expect(shouldPrune(() => 0.99)).toBe(false);
  });
});

describe("windowStart / pruneCutoff", () => {
  it("windowStart is exactly one window before now", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(windowStart(now).getTime()).toBe(now.getTime() - RATE_LIMIT_WINDOW_MS);
  });

  it("pruneCutoff is exactly one TTL before now", () => {
    const now = new Date("2026-01-01T12:00:00Z");
    expect(pruneCutoff(now).getTime()).toBe(now.getTime() - RATE_EVENT_TTL_MS);
  });
});
