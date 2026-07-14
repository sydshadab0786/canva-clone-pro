import { expect, test } from '@playwright/test';

/**
 * Authenticated flow against a REAL running API + database.
 *
 * Skipped unless E2E_WITH_API=1, because the default CI e2e job runs the web
 * app alone. Run locally with the stack up:
 *   E2E_WITH_API=1 pnpm --filter @ccp/web test:e2e
 *
 * Regression guard: /auth/me returns only the JWT principal (id/email/role).
 * The AuthGuard used to call it and clobber the stored user, wiping
 * displayName and crashing the dashboard on `displayName.split(...)`.
 */
const ADMIN = { email: 'admin@canvaclone.pro', password: 'Admin123!Change' };

test.describe('authenticated dashboard', () => {
  test.skip(process.env.E2E_WITH_API !== '1', 'requires a running API + seeded DB');

  test('logs in and renders the dashboard with the user name', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/login');
    await page.getByLabel(/email/i).fill(ADMIN.email);
    await page.getByLabel(/password/i).fill(ADMIN.password);
    await page.getByRole('button', { name: /^log in$/i }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    // The greeting proves displayName survived the AuthGuard's profile fetch.
    await expect(page.getByRole('heading', { name: /welcome, platform/i })).toBeVisible();

    // Seeded templates load from the real DB.
    await page.goto('/dashboard/templates');
    await expect(page.getByText(/bold quote/i).first()).toBeVisible();

    // Admin link is visible for SUPER_ADMIN, and the panel loads.
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /^dashboard$/i })).toBeVisible();

    expect(errors, `unhandled runtime errors: ${errors.join(' | ')}`).toEqual([]);
  });
});
