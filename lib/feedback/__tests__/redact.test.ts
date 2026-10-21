import { describe, it, expect } from "vitest";
import { redactText, redactFields } from "../redact";

describe("redactText", () => {
  it("redacts a colon-separated MAC address", () => {
    expect(redactText("Device: aa:bb:cc:dd:ee:ff")).toBe("Device: [REDACTED-MAC]");
  });

  it("redacts a hyphen-separated MAC address", () => {
    expect(redactText("Device: AA-BB-CC-DD-EE-FF")).toBe("Device: [REDACTED-MAC]");
  });

  it("redacts a serial-number-looking string", () => {
    expect(redactText("Serial ABC123XYZ9 here")).toBe("Serial [REDACTED-SERIAL] here");
  });

  it("does not redact plain prose", () => {
    const input = "The app crashed when I clicked save after opening settings";
    expect(redactText(input)).toBe(input);
  });

  it("does not redact short alphanumeric words", () => {
    expect(redactText("v1 build 2")).toBe("v1 build 2");
  });

  it("handles empty string", () => {
    expect(redactText("")).toBe("");
  });

  it("redacts multiple MAC addresses in the same string", () => {
    const input = "a=aa:bb:cc:dd:ee:ff b=11:22:33:44:55:66";
    expect(redactText(input)).toBe("a=[REDACTED-MAC] b=[REDACTED-MAC]");
  });
});

describe("redactFields", () => {
  it("redacts all string fields in an object", () => {
    const input = { macosVersion: "15.1", macModel: "serial AA:BB:CC:DD:EE:FF here" };
    const result = redactFields(input);
    expect(result.macModel).toContain("[REDACTED-MAC]");
  });

  it("leaves non-string fields untouched", () => {
    const input = { count: 5 } as unknown as Record<string, unknown>;
    const result = redactFields(input);
    expect(result.count).toBe(5);
  });
});
