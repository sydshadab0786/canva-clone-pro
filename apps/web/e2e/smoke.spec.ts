import { expect, test } from '@playwright/test';

/**
 * Smoke E2E: verifies the marketing + auth entry points render and navigate.
 * These require only the web app (no API), so they stay fast and hermetic in CI.
 */

test('landing page renders the hero and CTAs', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /complete design platform/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /start designing/i })).toBeVisible();
});

/**
 * Guard against the page rendering as raw, unstyled HTML.
 *
 * A production `next build` writing into the same directory `next dev` serves
 * from left every CSS/JS chunk 404ing — the app still returned 200 and all the
 * text assertions above passed, but the page had no styling at all. Assert the
 * stylesheet actually loads AND that Tailwind utilities produce real computed
 * styles.
 */
test('landing page is actually styled (CSS bundle loads)', async ({ page }) => {
  const failed: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400 && /\/_next\/static\/.*\.(css|js)$/.test(r.url())) {
      failed.push(`${r.status()} ${new URL(r.url()).pathname}`);
    }
  });

  await page.goto('/');
  expect(failed, `static assets failed to load:\n${failed.join('\n')}`).toEqual([]);

  // At least one stylesheet is present.
  await expect(page.locator('link[rel="stylesheet"]').first()).toHaveCount(1);

  // The primary CTA must have a real (non-transparent) background from Tailwind.
  const bg = await page
    .getByRole('link', { name: /start designing/i })
    .locator('button')
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(bg, 'primary button has no background — Tailwind did not apply').not.toBe(
    'rgba(0, 0, 0, 0)',
  );
});

test('navigates to the login page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /^log in$/i }).first().click();
  // Generous timeout: in dev, the first navigation to /login compiles the route.
  await expect(page).toHaveURL(/\/login$/, { timeout: 30_000 });
  await expect(page.getByText(/welcome back/i)).toBeVisible({ timeout: 20_000 });
});

test('register page shows validation errors on empty submit', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByText(/create your account/i)).toBeVisible();
  await page.getByRole('button', { name: /create account/i }).click();
  // Zod client validation should surface at least one field error.
  await expect(page.getByText(/tell us your name|valid email|8 characters/i).first()).toBeVisible();
});

test('login form validates email format client-side', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill('not-an-email');
  await page.getByLabel(/password/i).fill('x');
  await page.getByRole('button', { name: /^log in$/i }).click();
  await expect(page.getByText(/valid email/i)).toBeVisible();
});
