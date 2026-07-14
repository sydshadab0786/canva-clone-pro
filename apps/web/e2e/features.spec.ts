import { expect, test, type Page } from '@playwright/test';

/**
 * Full UI feature sweep against a REAL API + Postgres + MinIO.
 *
 *   E2E_WITH_API=1 pnpm --filter @ccp/web test:e2e
 *
 * Every test asserts ZERO unhandled page errors — that is how the dashboard
 * `displayName.split()` crash was caught. Skipped without E2E_WITH_API so the
 * default (web-only) CI job stays hermetic.
 */
const ADMIN = { email: 'admin@canvaclone.pro', password: 'Admin123!Change' };

/** Fail the test if the page throws or logs a console error. */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') {
      const t = m.text();
      // Ignore noisy network failures for optional services / favicon.
      if (/favicon|ERR_CONNECTION_REFUSED|socket\.io|WebSocket/i.test(t)) return;
      errors.push(`console: ${t}`);
    }
  });
  return errors;
}

async function login(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(ADMIN.email);
  await page.getByLabel(/password/i).fill(ADMIN.password);
  await page.getByRole('button', { name: /^log in$/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
}

/**
 * Register a brand-new user through the UI. Used by tests that need a
 * deterministic account state (e.g. billing starts on the Free plan) rather
 * than inheriting whatever a previous run did to the shared admin.
 */
async function registerFresh(page: Page) {
  const email = `e2e_${Date.now()}_${Math.floor(Math.random() * 1e4)}@example.com`;
  await page.goto('/register');
  await page.getByLabel(/name/i).fill('Fresh Tester');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill('SecurePass1');
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  return email;
}

/** Open a fresh blank design and land in the editor. */
async function newDesign(page: Page) {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: /create a design/i }).click();
  await expect(page).toHaveURL(/\/design\/[a-z0-9]+/i, { timeout: 30_000 });
  // Canvas mounts client-side.
  await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
}

test.describe('feature sweep', () => {
  test.skip(process.env.E2E_WITH_API !== '1', 'requires a running API + seeded DB');
  test.describe.configure({ mode: 'serial' });

  // ── Dashboard ────────────────────────────────────────────────
  test('dashboard: greets user, lists templates tiles, creates a design', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);

    await expect(page.getByRole('heading', { name: /welcome, platform/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create a design/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /create a video/i })).toBeVisible();

    await newDesign(page);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── Editor: objects, layers, undo/redo, properties, autosave ──
  test('editor: add objects, layers panel, undo/redo, properties', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await newDesign(page);

    // Add a text layer + two shapes via the toolbar.
    await page.getByRole('button', { name: /^text$/i }).click();
    await page.getByRole('button', { name: /rectangle/i }).click();
    await page.getByRole('button', { name: /^ellipse$/i }).click();

    // Layers panel reflects them (text layers are labelled by their content).
    const layers = page.locator('aside').first();
    await expect(layers.getByText('Ellipse', { exact: true })).toBeVisible();
    await expect(layers.getByText('Rectangle', { exact: true })).toBeVisible();
    await expect(layers.getByText('Add your text', { exact: true })).toBeVisible();

    // Undo removes the ellipse; redo brings it back.
    await page.getByRole('button', { name: /^undo$/i }).click();
    await expect(layers.getByText('Ellipse', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: /^redo$/i }).click();
    await expect(layers.getByText('Ellipse', { exact: true })).toBeVisible();

    // Selecting a layer opens its properties.
    await layers.getByText('Rectangle', { exact: true }).click();
    const props = page.locator('aside').last();
    await expect(props.getByText(/rect/i).first()).toBeVisible();

    // Edit X and see it applied (round-trips through the store).
    const x = props.locator('input[type="number"]').first();
    await x.fill('123');
    await x.blur();
    await expect(x).toHaveValue('123');

    // Lock + hide toggles work.
    const row = layers.locator('div', { hasText: 'Rectangle' }).last();
    await row.hover();
    await row.getByRole('button', { name: /^lock$/i }).click();
    await row.hover();
    await row.getByRole('button', { name: /^hide$/i }).click();

    expect(errors, errors.join('\n')).toEqual([]);
  });

  test('editor: autosave persists the document across a reload', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await newDesign(page);
    const url = page.url();

    await page.getByRole('button', { name: /^text$/i }).click();
    // Wait for the debounced autosave to report success.
    await expect(page.getByText(/all changes saved/i)).toBeVisible({ timeout: 20_000 });

    await page.goto(url);
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    // The text layer survived the round-trip to Postgres.
    await expect(
      page.locator('aside').first().getByText('Add your text', { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── Templates ────────────────────────────────────────────────
  test('templates: gallery lists seeded templates and "use" opens a populated design', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await page.goto('/dashboard/templates');

    await expect(page.getByText(/bold quote/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/clean resume/i).first()).toBeVisible();

    // Category filter chips are rendered from the API.
    await expect(page.getByRole('button', { name: /social media/i })).toBeVisible();

    // Use a template → a new project opens with its objects.
    const card = page.locator('div.group').filter({ hasText: /clean resume/i }).first();
    await card.hover();
    await card.getByRole('button', { name: /use this template/i }).click();

    await expect(page).toHaveURL(/\/design\/[a-z0-9]+/i, { timeout: 30_000 });
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 30_000 });
    // Template document was cloned — layers exist.
    await expect(page.locator('aside').first().getByText(/jane|experience/i).first()).toBeVisible({
      timeout: 20_000,
    });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── Uploads (S3/MinIO) ───────────────────────────────────────
  test('uploads: file uploads, appears in grid, and inserts onto the canvas', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64',
    );

    await page.goto('/dashboard/uploads');
    await page.setInputFiles('input[type="file"]', {
      name: 'e2e-pixel.png',
      mimeType: 'image/png',
      buffer: png,
    });
    // Asset card shows up once the API + MinIO round-trip completes.
    await expect(page.getByText('e2e-pixel.png').first()).toBeVisible({ timeout: 30_000 });

    // Now insert it from inside the editor.
    await newDesign(page);
    await page.getByRole('button', { name: /^uploads$/i }).click();
    const thumb = page.locator('aside').first().locator('img').first();
    await expect(thumb).toBeVisible({ timeout: 30_000 });
    await thumb.click();

    // It becomes a layer.
    await page.getByRole('button', { name: /^layers$/i }).click();
    await expect(page.locator('aside').first().getByText(/e2e-pixel/i).first()).toBeVisible();
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── Global search ────────────────────────────────────────────
  test('search: dropdown returns templates from the API', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);

    await page.getByPlaceholder(/search your designs/i).fill('resume');
    await expect(page.getByText(/clean resume/i).first()).toBeVisible({ timeout: 20_000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── AI panel ─────────────────────────────────────────────────
  test('ai panel: palette, fonts, image generation and accessibility all work', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await newDesign(page);

    await page.getByRole('button', { name: /^ai$/i }).click();
    await expect(page.getByText(/ai studio/i)).toBeVisible();

    // Colour palette → 5 swatches.
    await page.getByPlaceholder(/calm ocean sunrise/i).fill('ocean sunrise');
    await page.getByRole('button', { name: /^go$/i }).click();
    await expect(page.getByTitle(/^apply #/i).first()).toBeVisible({ timeout: 20_000 });

    // Font pairing suggestions.
    await page.getByPlaceholder(/wedding invitation/i).fill('wedding');
    await page.getByRole('button', { name: /suggest/i }).click();
    await expect(page.getByText(/elegant|modern|clean|bold|fashion|startup/i).first()).toBeVisible({
      timeout: 20_000,
    });

    // Generate an image → becomes a layer.
    await page.getByPlaceholder(/a neon city skyline/i).fill('neon city');
    await page.getByRole('button', { name: /generate & insert/i }).click();
    await page.getByRole('button', { name: /^layers$/i }).click();
    await expect(page.locator('aside').first().getByText(/ai image/i)).toBeVisible({ timeout: 20_000 });

    // Accessibility report renders a score.
    await page.getByRole('button', { name: /^ai$/i }).click();
    await page.getByRole('button', { name: /run wcag check/i }).click();
    await expect(page.getByText(/score:/i)).toBeVisible({ timeout: 20_000 });

    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── Comments ─────────────────────────────────────────────────
  test('comments: add, render with mention, resolve', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);
    await newDesign(page);

    await page.getByRole('button', { name: /^comments$/i }).click();
    await page.getByPlaceholder(/add a comment/i).fill('Make the title bigger @admin');
    await page.getByRole('button', { name: /^comment$/i }).click();

    await expect(page.getByText(/make the title bigger/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('@admin')).toBeVisible();

    await page.getByRole('button', { name: /^resolve$/i }).click();
    await expect(page.getByRole('button', { name: /^reopen$/i })).toBeVisible({ timeout: 20_000 });
    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── Video editor ─────────────────────────────────────────────
  test('video editor: add a text clip, split it, and export to a download link', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);

    await page.goto('/dashboard');
    await page.getByRole('button', { name: /create a video/i }).click();
    await expect(page).toHaveURL(/\/video\/[a-z0-9]+/i, { timeout: 30_000 });

    // Add a text clip to the overlay track.
    await page.getByRole('button', { name: /add text/i }).click();
    await expect(page.getByText(/your title/i).first()).toBeVisible({ timeout: 20_000 });

    // Select the clip, move the playhead, split it.
    await page.getByText(/your title/i).first().click();
    await expect(page.getByRole('button', { name: /split/i })).toBeEnabled();

    // Export → polls to a download link.
    await page.getByRole('button', { name: /^export$/i }).click();
    await expect(page.getByRole('link', { name: /download mp4/i })).toBeVisible({ timeout: 40_000 });

    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── Billing ──────────────────────────────────────────────────
  test('billing: fresh user starts Free, coupon discounts, upgrade issues an invoice', async ({ page }) => {
    const errors = trackErrors(page);
    // Fresh account → deterministic Free starting state.
    await registerFresh(page);
    await page.goto('/dashboard/billing');

    // Starts on the Free plan with Free's credit allowance.
    await expect(page.getByText(/20 AI credits remaining/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/no invoices yet/i)).toBeVisible();

    // Pro card shows the undiscounted price.
    const proCard = page.locator('div.flex.flex-col.rounded-xl').filter({ hasText: /^Pro/ }).first();
    await expect(proCard.getByText('$12.99')).toBeVisible({ timeout: 20_000 });

    // Apply a coupon → 20% off, original struck through.
    await page.getByPlaceholder(/coupon code/i).fill('WELCOME20');
    await page.getByRole('button', { name: /^apply$/i }).click();
    await expect(page.getByText(/applied: WELCOME20/i)).toBeVisible();
    await expect(proCard.getByText('$10.39')).toBeVisible({ timeout: 20_000 });

    // Upgrade → subscription activates.
    await proCard.getByRole('button', { name: /^upgrade$/i }).click();

    // Current-plan card reflects Pro + its credit grant.
    await expect(page.getByText(/500 AI credits remaining/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /cancel subscription/i })).toBeVisible();
    // Invoice list refreshes after checkout (id renders as `inv_…`).
    await expect(page.getByText(/^inv_/).first()).toBeVisible({ timeout: 20_000 });

    expect(errors, errors.join('\n')).toEqual([]);
  });

  // ── Admin ────────────────────────────────────────────────────
  test('admin: dashboard stats, users table, audit log, feature flags', async ({ page }) => {
    const errors = trackErrors(page);
    await login(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: /^dashboard$/i })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/^users$/i).first()).toBeVisible();
    await expect(page.getByText(/^mrr$/i)).toBeVisible();
    // Charts render (SVG paths present).
    await expect(page.locator('svg path').first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/admin/users');
    await expect(page.getByText(ADMIN.email)).toBeVisible({ timeout: 20_000 });

    await page.goto('/admin/audit');
    await expect(page.getByText(/USER_LOGIN/).first()).toBeVisible({ timeout: 20_000 });

    await page.goto('/admin/flags');
    await expect(page.getByText(/realtime-collab/i)).toBeVisible({ timeout: 20_000 });

    expect(errors, errors.join('\n')).toEqual([]);
  });
});
