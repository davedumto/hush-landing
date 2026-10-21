import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { signSessionToken, COOKIE_NAME } from "../admin-auth";
import { isAuthorizedRequest } from "../require-admin";

function makeRequest({ cookie, auth }: { cookie?: string; auth?: string } = {}) {
  const headers: Record<string, string> = {};
  if (cookie) headers.cookie = cookie;
  if (auth) headers.authorization = auth;
  return new NextRequest("http://localhost/api/admin/list", { headers });
}

describe("isAuthorizedRequest", () => {
  beforeEach(() => {
    process.env.COOKIE_SECRET = "cookie-secret";
    process.env.ADMIN_TOKEN = "bearer-token";
  });

  it("authorizes a request with a valid session cookie", () => {
    const token = signSessionToken("cookie-secret");
    const req = makeRequest({ cookie: `${COOKIE_NAME}=${token}` });
    expect(isAuthorizedRequest(req)).toBe(true);
  });

  it("authorizes a request with a valid bearer token", () => {
    const req = makeRequest({ auth: "Bearer bearer-token" });
    expect(isAuthorizedRequest(req)).toBe(true);
  });

  it("rejects a request with no credentials", () => {
    const req = makeRequest();
    expect(isAuthorizedRequest(req)).toBe(false);
  });

  it("rejects a request with an invalid cookie and no bearer token", () => {
    const req = makeRequest({ cookie: `${COOKIE_NAME}=garbage` });
    expect(isAuthorizedRequest(req)).toBe(false);
  });

  it("rejects a request with the wrong bearer token", () => {
    const req = makeRequest({ auth: "Bearer wrong-token" });
    expect(isAuthorizedRequest(req)).toBe(false);
  });
});
