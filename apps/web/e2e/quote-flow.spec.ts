import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import { join } from "path";

// Fixtures seeded by e2e/global-setup.ts (Playwright globalSetup), torn down after.
const F = JSON.parse(readFileSync(join(process.cwd(), "e2e", ".fixtures.json"), "utf8"));

// Enter the correct PIN and wait for the gate to disappear (proposal unlocked).
async function unlock(page: import("@playwright/test").Page, token: string) {
  await page.goto(`/q/${token}`);
  await page.fill('input[name="pin"]', F.pin);
  await page.click('button:has-text("View proposal")');
  await page.waitForSelector('input[name="pin"]', { state: "detached", timeout: 15000 });
}

// FV-08 — wrong PIN locks the proposal after repeated attempts. Wait for each
// response so every failure registers even under parallel-suite load.
test("FV-08: quote PIN brute-force is locked out", async ({ page }) => {
  test.setTimeout(90000);
  await page.goto(`/q/${F.pinToken}`);
  const btn = page.getByRole("button", { name: /View proposal|Opening/i });
  for (let i = 0; i < 11; i++) {
    await page.fill('input[name="pin"]', "000000");
    await expect(btn).toBeEnabled({ timeout: 30000 }); // prev submit settled
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST", { timeout: 30000 }),
      btn.click(),
    ]);
    if (await page.getByText(/Too many attempts/i).count()) break;
  }
  await expect(page.getByText(/Too many attempts/i)).toBeVisible({ timeout: 15000 });
});

// FV-09 — a REJECTED quote exposes no Accept control.
test("FV-09: rejected quote cannot be accepted", async ({ page }) => {
  await unlock(page, F.rejectedToken);
  await expect(page.getByRole("button", { name: /Accept & Proceed/i })).toHaveCount(0);
  await expect(page.locator('input[name="amount"]')).toHaveCount(0);
});

// FV-10 — double-clicking Accept is idempotent (no 500, one booking — see assert step).
test("FV-10: accept is idempotent under double-click", async ({ page }) => {
  // The pre-fix bug threw a 500 (unique-constraint race) on the second click.
  const serverErrors: number[] = [];
  page.on("response", (r) => { if (r.status() >= 500) serverErrors.push(r.status()); });

  await unlock(page, F.acceptToken);
  const accept = page.getByRole("button", { name: /Accept & Proceed/i });
  await expect(accept).toBeVisible();
  const post = page.waitForResponse((r) => r.request().method() === "POST", { timeout: 15000 }).catch(() => {});
  // Two near-simultaneous clicks (bounded + forced so the 2nd doesn't auto-wait
  // for the button that the 1st click disables/removes).
  await Promise.allSettled([
    accept.click({ timeout: 5000 }),
    accept.click({ force: true, timeout: 5000 }),
  ]);
  await post;

  expect(serverErrors, "no 5xx during a double-clicked accept").toEqual([]);
  // The DB assert step then confirms exactly ONE booking + status ACCEPTED.
});

// FV-11 — payment above the outstanding balance is rejected.
test("FV-11: overpayment is rejected", async ({ page }) => {
  await unlock(page, F.acceptedToken);
  await expect(page.locator('input[name="amount"]')).toBeVisible();
  await page.fill('input[name="amount"]', "999999");
  await page.click('button:has-text("Submit payment proof")');
  await expect(page.getByText(/exceeds the outstanding balance/i)).toBeVisible({ timeout: 10000 });
});

// FV-12 — a SENT (not yet accepted) quote shows no payment form.
test("FV-12: cannot pay before accepting", async ({ page }) => {
  await unlock(page, F.sentToken);
  await expect(page.getByRole("button", { name: /Accept & Proceed/i })).toBeVisible();
  await expect(page.locator('input[name="amount"]')).toHaveCount(0);
});

// FV-13 — an expired quote (validUntil in the past) cannot actually be accepted.
test("FV-13: expired quote cannot be accepted", async ({ page }) => {
  await unlock(page, F.expiredToken);
  const accept = page.getByRole("button", { name: /Accept & Proceed/i });
  // UI may still show the button, but the server no-ops — state stays un-accepted.
  if (await accept.count()) {
    await accept.first().click().catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
  }
  // No payment section ever appears (would only show for a genuinely accepted quote).
  await expect(page.locator('input[name="amount"]')).toHaveCount(0);
});
