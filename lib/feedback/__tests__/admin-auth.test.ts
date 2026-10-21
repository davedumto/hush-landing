import { describe, it, expect } from "vitest";
import {
  checkPassword,
  signSessionToken,
  verifySessionToken,
  checkBearerToken,
} from "../admin-auth";

describe("checkPassword", () => {
  it("returns true for a matching password", () => {
    expect(checkPassword("secret", "secret")).toBe(true);
  });

  it("returns false for a non-matching password", () => {
    expect(checkPassword("wrong", "secret")).toBe(false);
  });

  it("returns false when expected is empty", () => {
    expect(checkPassword("anything", "")).toBe(false);
  });
});

describe("session tokens", () => {
  it("verifies a freshly signed token", () => {
    const token = signSessionToken("my-secret", Date.now());
    expect(verifySessionToken(token, "my-secret")).toBe(true);
  });

  it("rejects a token signed with a different secret", () => {
    const token = signSessionToken("secret-a", Date.now());
    expect(verifySessionToken(token, "secret-b")).toBe(false);
  });

  it("rejects a tampered token", () => {
    const token = signSessionToken("my-secret", Date.now());
    const tampered = token.slice(0, -1) + (token.endsWith("a") ? "b" : "a");
    expect(verifySessionToken(tampered, "my-secret")).toBe(false);
  });

  it("rejects an expired token", () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const token = signSessionToken("my-secret", eightDaysAgo);
    expect(verifySessionToken(token, "my-secret")).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(verifySessionToken(undefined, "my-secret")).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(verifySessionToken("not-a-valid-token", "my-secret")).toBe(false);
  });
});

describe("checkBearerToken", () => {
  it("accepts a correctly formatted matching bearer token", () => {
    expect(checkBearerToken("Bearer abc123", "abc123")).toBe(true);
  });

  it("rejects a non-matching token", () => {
    expect(checkBearerToken("Bearer wrong", "abc123")).toBe(false);
  });

  it("rejects a missing Authorization header", () => {
    expect(checkBearerToken(null, "abc123")).toBe(false);
  });

  it("rejects a header without the Bearer prefix", () => {
    expect(checkBearerToken("abc123", "abc123")).toBe(false);
  });

  it("rejects when expected token is empty", () => {
    expect(checkBearerToken("Bearer abc123", "")).toBe(false);
  });
});
