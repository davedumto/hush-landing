import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// Guards against regressions where a query is built by concatenating strings
// instead of going through Drizzle's query builder / parameterized sql`` tag.
const FILES_TO_CHECK = [
  "app/api/feedback/route.ts",
  "app/api/admin/list/route.ts",
  "app/admin/page.tsx",
  "app/admin/[id]/page.tsx",
  "app/admin/actions.ts",
];

describe("no raw SQL string building", () => {
  for (const relPath of FILES_TO_CHECK) {
    it(`${relPath} does not concatenate SQL strings outside drizzle's sql\`\` tag`, () => {
      const filePath = path.join(process.cwd(), relPath);
      const content = fs.readFileSync(filePath, "utf8");

      // Flag obviously dangerous patterns: template-literal or concatenated
      // strings passed to anything that looks like a raw query call.
      const suspiciousPatterns = [
        /\.query\(\s*`/,
        /\.execute\(\s*`[^`]*\$\{/,
        /"SELECT [^"]*"\s*\+/i,
        /'SELECT [^']*'\s*\+/i,
      ];

      for (const pattern of suspiciousPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    });
  }
});
