import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    // node by default (keeps pure-logic tests fast); component tests opt in
    // with a `// @vitest-environment happy-dom` pragma at the top of the file.
    environment: "node",
  },
});
