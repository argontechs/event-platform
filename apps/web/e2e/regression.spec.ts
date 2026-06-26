import { test, expect } from "@playwright/test";

// FV-30 — the WhatsApp webhook must reject anything without a valid Meta
// signature (fails closed when WHATSAPP_APP_SECRET is unset).
test("FV-30: unsigned WhatsApp webhook is rejected (403)", async ({ request }) => {
  const res = await request.post("/api/whatsapp/webhook", {
    headers: { "content-type": "application/json" },
    data: {
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "spoofed" },
                messages: [{ from: "60123456789", id: "m-forged-1", text: { body: "hi" } }],
              },
            },
          ],
        },
      ],
    },
  });
  expect(res.status()).toBe(403);
});

// FV-01 — login locks out after repeated wrong passwords. Uses a throwaway
// email so the real seeded admin is never locked. Each submit waits for the
// server response so every failure deterministically registers (bcrypt is slow
// and the dev server is single-process, so don't race ahead of it).
test("FV-01: login locks out after repeated failures", async ({ page }) => {
  test.setTimeout(90000);
  const email = "lockout-probe@example.com";
  await page.goto("/login");
  const btn = page.locator('button[type="submit"]');
  for (let i = 0; i < 11; i++) {
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', `wrong-${i}`);
    await expect(btn).toBeEnabled({ timeout: 30000 }); // prev submit settled
    await Promise.all([
      page.waitForResponse((r) => r.request().method() === "POST", { timeout: 30000 }),
      btn.click(),
    ]);
    if (await page.getByText(/Too many attempts/i).count()) break;
  }
  await expect(page.getByText(/Too many attempts/i)).toBeVisible({ timeout: 15000 });
});

// Protected routes bounce to login when there is no session.
test("protected back office redirects to login", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});

// Unknown public quote token must 404 (never leak data).
test("unknown quote token returns 404", async ({ request }) => {
  const res = await request.get("/q/this-token-does-not-exist");
  expect(res.status()).toBe(404);
});

// FV-28 — <html lang> follows the locale (set client-side by HtmlLang).
test("FV-28: <html lang> reflects the locale", async ({ page }) => {
  await page.goto("/ms");
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("ms");
  await page.goto("/zh");
  await expect.poll(() => page.evaluate(() => document.documentElement.lang)).toBe("zh");
});

// FV-29 — the Packages nav item is translated per locale.
test("FV-29: Packages nav is translated", async ({ page }) => {
  await page.goto("/ms");
  await expect(page.getByRole("link", { name: "Pakej" }).first()).toBeVisible();
  await page.goto("/zh");
  await expect(page.getByRole("link", { name: "配套" }).first()).toBeVisible();
});
