import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirror the tsconfig "@/*" alias so component tests can import app code.
    alias: { "@": path.resolve(__dirname, "src") },
  },
  // Next compiles JSX with the automatic runtime; match it so components
  // don't need `import React` when rendered in tests.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // node by default (keeps pure-logic tests fast); component tests opt in
    // with a `// @vitest-environment happy-dom` pragma at the top of the file.
    environment: "node",
  },
});
