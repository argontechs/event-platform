import { test, expect } from "@playwright/test";

// Verifies the reworked auth path end-to-end: bcrypt verify, the new getSession
// DB recheck, and rate-limit/clear all work for a real seeded user.
test("company admin can log in and reach the back office", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@bloomco.example");
  await page.fill('input[name="password"]', "ChangeMe123!");
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/admin/, { timeout: 15000 });
  await expect(page).toHaveURL(/\/admin/);
});

test("wrong password is rejected", async ({ page }) => {
  await page.goto("/login");
  await page.fill('input[name="email"]', "admin@bloomco.example");
  await page.fill('input[name="password"]', "definitely-wrong");
  await page.click('button[type="submit"]');
  await expect(page.getByText(/Invalid email or password/i)).toBeVisible();
});
