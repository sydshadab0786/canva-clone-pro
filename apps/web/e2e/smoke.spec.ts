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

test('navigates to the login page', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /^log in$/i }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: /welcome back/i })).toBeVisible();
});

test('register page shows validation errors on empty submit', async ({ page }) => {
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: /create your account/i })).toBeVisible();
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
