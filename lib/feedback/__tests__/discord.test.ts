import { describe, it, expect, vi, afterEach } from "vitest";
import { buildDiscordEmbed, sendDiscordEmbed } from "../discord";
import type { FeedbackInput } from "../validation";

const baseInput: FeedbackInput = {
  type: "bug",
  title: "Crashes on launch",
  description: { whatHappened: "It crashed", steps: "Open app", expected: "Should open" },
};

describe("buildDiscordEmbed", () => {
  it("uses red for bug reports", () => {
    const embed = buildDiscordEmbed(baseInput, new Date());
    expect(embed.color).toBe(0xe74c3c);
    expect(embed.title).toContain("Bug");
  });

  it("uses green for feature requests", () => {
    const input: FeedbackInput = {
      type: "feature",
      title: "Add dark mode",
      description: { featureDescription: "Please add dark mode" },
    };
    const embed = buildDiscordEmbed(input, new Date());
    expect(embed.color).toBe(0x2ecc71);
    expect(embed.title).toContain("Feature");
  });

  it("includes the reply email as its own field", () => {
    const input: FeedbackInput = { ...baseInput, replyEmail: "user@example.com" };
    const embed = buildDiscordEmbed(input, new Date());
    const field = embed.fields.find((f) => f.name === "Reply email");
    expect(field?.value).toBe("user@example.com");
  });

  it("truncates the description to Discord's embed limit", () => {
    const input: FeedbackInput = {
      ...baseInput,
      description: { whatHappened: "x".repeat(5000) },
    };
    const embed = buildDiscordEmbed(input, new Date());
    expect(embed.description!.length).toBeLessThanOrEqual(4096);
  });

  it("truncates diagnostics to fit the field value limit", () => {
    const input: FeedbackInput = { ...baseInput, diagnostics: "y".repeat(5000) };
    const embed = buildDiscordEmbed(input, new Date());
    const field = embed.fields.find((f) => f.name === "Diagnostics");
    expect(field!.value.length).toBeLessThanOrEqual(1024);
  });

  it("wraps diagnostics in a code block", () => {
    const input: FeedbackInput = { ...baseInput, diagnostics: "log line 1\nlog line 2" };
    const embed = buildDiscordEmbed(input, new Date());
    const field = embed.fields.find((f) => f.name === "Diagnostics");
    expect(field!.value.startsWith("```")).toBe(true);
    expect(field!.value.endsWith("```")).toBe(true);
  });

  it("omits optional fields when not provided", () => {
    const embed = buildDiscordEmbed(baseInput, new Date());
    expect(embed.fields.find((f) => f.name === "Reply email")).toBeUndefined();
    expect(embed.fields.find((f) => f.name === "Diagnostics")).toBeUndefined();
  });
});

describe("sendDiscordEmbed", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns true when the webhook responds ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const result = await sendDiscordEmbed("https://discord.test/webhook", buildDiscordEmbed(baseInput, new Date()));
    expect(result).toBe(true);
  });

  it("returns false when the webhook responds with an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await sendDiscordEmbed("https://discord.test/webhook", buildDiscordEmbed(baseInput, new Date()));
    expect(result).toBe(false);
  });

  it("returns false and does not throw when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await sendDiscordEmbed("https://discord.test/webhook", buildDiscordEmbed(baseInput, new Date()));
    expect(result).toBe(false);
  });
});
