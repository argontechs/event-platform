import { test, expect } from "@playwright/test";

// Smoke test — proves the E2E toolchain reaches the running app.
// Replace/extend with real flow specs (enquiry → quote → invoice, login, RBAC).

test("health endpoint is ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  expect((await res.json()).status).toBe("ok");
});

test("public home renders the seeded company", async ({ page }) => {
  await page.goto("/en");
  await expect(page).toHaveTitle(/Events & Decoration/i);
});
