import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const insertedRateEvents: unknown[] = [];
const insertedFeedback: Record<string, unknown>[] = [];
let ipCount = 0;
let clientCount = 0;

vi.mock("@/lib/feedback/db", () => {
  return {
    db: () => ({
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([{ count: ipCount || clientCount }]),
        }),
      }),
      insert: () => ({
        values: (values: unknown) => {
          if (Array.isArray(values)) {
            insertedRateEvents.push(...values);
            return Promise.resolve();
          }
          insertedFeedback.push(values as Record<string, unknown>);
          return {
            returning: () =>
              Promise.resolve([{ id: "11111111-1111-1111-1111-111111111111", createdAt: new Date() }]),
          };
        },
      }),
      update: () => ({ set: () => ({ where: () => Promise.resolve() }) }),
      delete: () => ({ where: () => Promise.resolve() }),
    }),
  };
});

import { POST } from "../route";

function makeRequest(body: unknown, headers: Record<string, string> = {}) {
  const payload = JSON.stringify(body);
  return new NextRequest("http://localhost/api/feedback", {
    method: "POST",
    body: payload,
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(payload)), ...headers },
  });
}

const validBody = {
  type: "bug",
  title: "Crashes on launch",
  description: { whatHappened: "It crashed" },
  clientUuid: "client-1",
};

describe("POST /api/feedback", () => {
  beforeEach(() => {
    insertedRateEvents.length = 0;
    insertedFeedback.length = 0;
    ipCount = 0;
    clientCount = 0;
    process.env.IP_HASH_SALT = "test-salt";
    delete process.env.DISCORD_WEBHOOK_URL;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok:true and inserts a row for a valid request", async () => {
    const res = await POST(makeRequest(validBody));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(insertedFeedback).toHaveLength(1);
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new NextRequest("http://localhost/api/feedback", {
      method: "POST",
      body: "not json",
      headers: { "content-type": "application/json" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for a validation failure", async () => {
    const res = await POST(makeRequest({ type: "bug", title: "", description: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 413 when content-length exceeds the limit", async () => {
    const req = new NextRequest("http://localhost/api/feedback", {
      method: "POST",
      body: "{}",
      headers: { "content-type": "application/json", "content-length": String(21 * 1024) },
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("silently succeeds on the honeypot path without inserting anything", async () => {
    const res = await POST(makeRequest({ ...validBody, honeypot: "i-am-a-bot" }));
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(insertedFeedback).toHaveLength(0);
    expect(insertedRateEvents).toHaveLength(0);
  });

  it("returns 429 with Retry-After when the ip rate limit is exceeded", async () => {
    ipCount = 10;
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(insertedFeedback).toHaveLength(0);
  });

  it("returns 429 when the client rate limit is exceeded", async () => {
    clientCount = 10;
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(429);
  });

  it("redacts a MAC address found in a text field before storing", async () => {
    await POST(
      makeRequest({
        ...validBody,
        description: { whatHappened: "Paired with aa:bb:cc:dd:ee:ff and it crashed" },
      })
    );
    const stored = insertedFeedback[0];
    const fields = stored.fields as Record<string, string>;
    expect(fields.whatHappened).toContain("[REDACTED-MAC]");
    expect(fields.whatHappened).not.toContain("aa:bb:cc:dd:ee:ff");
  });
});
