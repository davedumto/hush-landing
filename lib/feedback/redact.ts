const MAC_ADDRESS_RE = /\b([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g;

// Serial-number-looking strings: 8+ chars, mixing letters and digits, no spaces.
const SERIAL_RE = /\b(?=[A-Za-z0-9]{8,}\b)(?=[A-Za-z0-9]*[0-9])(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]{8,}\b/g;

export function redactText(input: string): string {
  if (!input) return input;
  let out = input.replace(MAC_ADDRESS_RE, "[REDACTED-MAC]");
  out = out.replace(SERIAL_RE, "[REDACTED-SERIAL]");
  return out;
}

export function redactFields<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = { ...obj };
  for (const key of Object.keys(out)) {
    const value = out[key];
    if (typeof value === "string") {
      out[key] = redactText(value);
    }
  }
  return out as T;
}
