import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

const F = JSON.parse(readFileSync(join(process.cwd(), "e2e", ".fixtures.json"), "utf8"));

// FV-18 — a PAYMENT_PROOF file must NOT be fetchable without a valid staff session.
test("FV-18: payment proof is blocked when logged out", async ({ request }) => {
  const res = await request.get(F.proofUrl);
  expect(res.status()).toBe(403);
});

// FV-19 — PORTFOLIO images stay public (no regression for the marketing site).
test("FV-19: public portfolio image still loads", async ({ request }) => {
  const res = await request.get(F.portfolioUrl);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
});
