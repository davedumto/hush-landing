import { describe, it, expect } from "vitest";
import { feedbackSchema, LIMITS } from "../validation";

describe("feedbackSchema", () => {
  it("accepts a valid bug report", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      title: "Crashes on launch",
      description: { whatHappened: "It crashed", steps: "Open app", expected: "Should open" },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid feature request", () => {
    const result = feedbackSchema.safeParse({
      type: "feature",
      title: "Add dark mode",
      description: { featureDescription: "Please add dark mode" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid type", () => {
    const result = feedbackSchema.safeParse({
      type: "other",
      title: "x",
      description: { whatHappened: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects when no description field is present", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      title: "x",
      description: {},
    });
    expect(result.success).toBe(false);
  });

  it("rejects a title over the max length", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      title: "x".repeat(LIMITS.TITLE_MAX + 1),
      description: { whatHappened: "x" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects a text field over the max length", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      title: "x",
      description: { whatHappened: "x".repeat(LIMITS.TEXT_MAX + 1) },
    });
    expect(result.success).toBe(false);
  });

  it("rejects diagnostics over the max length", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      title: "x",
      description: { whatHappened: "x" },
      diagnostics: "x".repeat(LIMITS.DIAGNOSTICS_MAX + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid reply email", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      title: "x",
      description: { whatHappened: "x" },
      replyEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("accepts an empty-string reply email", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      title: "x",
      description: { whatHappened: "x" },
      replyEmail: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid reply email", () => {
    const result = feedbackSchema.safeParse({
      type: "bug",
      title: "x",
      description: { whatHappened: "x" },
      replyEmail: "user@example.com",
    });
    expect(result.success).toBe(true);
  });
});
