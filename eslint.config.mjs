import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // This project does not use the React Compiler, and its scroll-driven stage
    // (lib/journey, lib/frames, components/PageShell) intentionally mirrors the
    // reference page's single imperative tick() loop with refs/closures for
    // frame-exact behavior parity, per the project brief. The compiler-oriented
    // "refs"/"immutability" rules assume components are auto-memoized and flag
    // that pattern; they don't apply here.
    rules: {
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
