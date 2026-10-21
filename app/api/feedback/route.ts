import { NextRequest, NextResponse } from "next/server";
import { feedbackSchema } from "@/lib/feedback/validation";
import { redactFields, redactText } from "@/lib/feedback/redact";
import { stripHtmlAndControlChars } from "@/lib/feedback/sanitize";
import {
  hashKey,
  isRateLimited,
  shouldPrune,
  windowStart,
  pruneCutoff,
  RATE_LIMIT_WINDOW_MS,
} from "@/lib/feedback/rate-limit";
import { buildDiscordEmbed, sendDiscordEmbed } from "@/lib/feedback/discord";
import { db } from "@/lib/feedback/db";
import { feedback, rateEvents } from "@/lib/feedback/schema";
import { and, eq, gte, lt, sql } from "drizzle-orm";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 20 * 1024;

function getClientIp(req: NextRequest): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  return "unknown";
}

function sanitizeDeep(value: string): string {
  return redactText(stripHtmlAndControlChars(value));
}

export async function POST(req: NextRequest) {
  const contentLength = req.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ ok: false, error: "Payload too large" }, { status: 413 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = feedbackSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Honeypot: silently succeed without doing anything else.
  if (input.honeypot) {
    return NextResponse.json({ ok: true });
  }

  const salt = process.env.IP_HASH_SALT ?? "";
  const ip = getClientIp(req);
  const ipHash = hashKey(ip, salt);
  const clientUuid = input.clientUuid ?? "";
  const clientHash = clientUuid ? hashKey(clientUuid, salt) : null;

  const database = db();
  const now = new Date();
  const since = windowStart(now);

  const ipCountResult = await database
    .select({ count: sql<number>`count(*)` })
    .from(rateEvents)
    .where(and(eq(rateEvents.keyHash, ipHash), eq(rateEvents.kind, "ip"), gte(rateEvents.createdAt, since)));
  const ipCount = Number(ipCountResult[0]?.count ?? 0);

  let clientCount = 0;
  if (clientHash) {
    const clientCountResult = await database
      .select({ count: sql<number>`count(*)` })
      .from(rateEvents)
      .where(
        and(eq(rateEvents.keyHash, clientHash), eq(rateEvents.kind, "client"), gte(rateEvents.createdAt, since))
      );
    clientCount = Number(clientCountResult[0]?.count ?? 0);
  }

  if (isRateLimited(ipCount, clientCount)) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)) } }
    );
  }

  const eventsToInsert: { keyHash: string; kind: "ip" | "client" }[] = [{ keyHash: ipHash, kind: "ip" }];
  if (clientHash) eventsToInsert.push({ keyHash: clientHash, kind: "client" });
  await database.insert(rateEvents).values(eventsToInsert);

  if (shouldPrune()) {
    const cutoff = pruneCutoff(now);
    await database.delete(rateEvents).where(lt(rateEvents.createdAt, cutoff));
  }

  const sanitizedInput = {
    ...input,
    title: sanitizeDeep(input.title),
    description: {
      whatHappened: input.description.whatHappened ? sanitizeDeep(input.description.whatHappened) : undefined,
      steps: input.description.steps ? sanitizeDeep(input.description.steps) : undefined,
      expected: input.description.expected ? sanitizeDeep(input.description.expected) : undefined,
      featureDescription: input.description.featureDescription
        ? sanitizeDeep(input.description.featureDescription)
        : undefined,
    },
    diagnostics: input.diagnostics ? sanitizeDeep(input.diagnostics) : undefined,
    model: input.model ? sanitizeDeep(input.model) : undefined,
    profileName: input.profileName ? sanitizeDeep(input.profileName) : undefined,
  };
  const redactedFields = redactFields({
    appVersion: sanitizedInput.appVersion ?? "",
    appBuild: sanitizedInput.appBuild ?? "",
    macosVersion: sanitizedInput.macosVersion ?? "",
    macModel: sanitizedInput.macModel ?? "",
    locale: sanitizedInput.locale ?? "",
  });

  const [row] = await database
    .insert(feedback)
    .values({
      type: sanitizedInput.type,
      title: sanitizedInput.title,
      fields: sanitizedInput.description,
      model: sanitizedInput.model ?? null,
      replyEmail: sanitizedInput.replyEmail || null,
      appVersion: redactedFields.appVersion || null,
      appBuild: redactedFields.appBuild || null,
      macosVersion: redactedFields.macosVersion || null,
      macModel: redactedFields.macModel || null,
      profileName: sanitizedInput.profileName ?? null,
      locale: redactedFields.locale || null,
      diagnostics: sanitizedInput.diagnostics ?? null,
      clientUuid: clientUuid || null,
      ipHash,
      status: "new",
      discordSent: false,
    })
    .returning({ id: feedback.id, createdAt: feedback.createdAt });

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (webhookUrl && row) {
    const embed = buildDiscordEmbed(sanitizedInput, row.createdAt);
    const sent = await sendDiscordEmbed(webhookUrl, embed);
    if (sent) {
      await database.update(feedback).set({ discordSent: true }).where(eq(feedback.id, row.id));
    }
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
export async function PUT() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
export async function PATCH() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
export async function DELETE() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
