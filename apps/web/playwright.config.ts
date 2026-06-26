import { defineConfig, devices } from "@playwright/test";

// Dev DB default for the fixture seeding — must be set BEFORE global-setup
// imports the Prisma client (which reads DATABASE_URL at module load).
process.env.DATABASE_URL ??= "postgresql://eventapp:eventapp@localhost:5432/eventapp?schema=public";

// E2E config. Assumes the dev server is already running on :3000
// (`npm run dev`). Run with `npx playwright test` from apps/web.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Single-process dev server — cap workers so CPU-heavy auth tests (bcrypt,
  // rate-limit loops) aren't starved, and allow one retry for load flakiness.
  workers: 3,
  retries: 1,
  reporter: "list",
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
