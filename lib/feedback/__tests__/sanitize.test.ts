import { describe, it, expect } from "vitest";
import { stripHtmlAndControlChars } from "../sanitize";

describe("stripHtmlAndControlChars", () => {
  it("removes script tags", () => {
    expect(stripHtmlAndControlChars("hi <script>alert(1)</script> there")).toBe("hi alert(1) there");
  });

  it("removes arbitrary HTML tags", () => {
    expect(stripHtmlAndControlChars("<b>bold</b> text")).toBe("bold text");
  });

  it("removes control characters but keeps newlines and tabs", () => {
    const input = "line one\nline\ttwo\x07bell";
    expect(stripHtmlAndControlChars(input)).toBe("line one\nline\ttwobell");
  });

  it("leaves plain text untouched", () => {
    const input = "Just a normal sentence.";
    expect(stripHtmlAndControlChars(input)).toBe(input);
  });

  it("handles empty string", () => {
    expect(stripHtmlAndControlChars("")).toBe("");
  });
});
