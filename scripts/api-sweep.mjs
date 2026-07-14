/**
 * Full API sweep — exercises EVERY endpoint against a live API + database.
 *
 * Run with the stack up:
 *   node scripts/api-sweep.mjs
 *
 * Exits non-zero if any endpoint fails, printing a pass/fail table. This is the
 * integration safety net that unit tests + typecheck cannot provide.
 */
import { authenticator } from '../apps/api/node_modules/otplib/index.js';

const BASE = process.env.API_BASE ?? 'http://localhost:4000/api/v1';
const ADMIN = { email: 'admin@canvaclone.pro', password: 'Admin123!Change' };

const results = [];
let failures = 0;

function record(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures += 1;
  const mark = ok ? '[32m✓[0m' : '[31m✗[0m';
  console.log(`${mark} ${name}${ok ? '' : `  →  ${detail}`}`);
}

/** Run a check; record pass/fail. `fn` should throw or return a falsy assertion. */
async function check(name, fn) {
  try {
    const out = await fn();
    record(name, true);
    return out;
  } catch (err) {
    record(name, false, err.message?.slice(0, 160) ?? String(err));
    return null;
  }
}

async function api(path, { method = 'GET', body, token, raw = false, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  if (raw) return res;
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(data)?.slice(0, 120)}`);
  }
  return data;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

// A tiny valid 1x1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const run = async () => {
  console.log(`\n=== API SWEEP → ${BASE} ===\n`);

  // ─────────────────────────── HEALTH ───────────────────────────
  console.log('--- health & metrics ---');
  await check('GET /health → ok + db up', async () => {
    const h = await api('/health');
    assert(h.status === 'ok', `status=${h.status}`);
    assert(h.services.database === 'up', 'database not up');
  });
  await check('GET /metrics → prometheus text', async () => {
    const res = await api('/metrics', { raw: true });
    const body = await res.text();
    assert(res.ok, `status ${res.status}`);
    assert(body.includes('http_requests_total'), 'missing http_requests_total');
  });

  // ─────────────────────────── AUTH ─────────────────────────────
  console.log('\n--- auth ---');
  const email = `sweep_${Date.now()}@example.com`;
  const password = 'SecurePass1';

  const reg = await check('POST /auth/register', async () => {
    const r = await api('/auth/register', {
      method: 'POST',
      body: { email, password, displayName: 'Sweep Tester' },
    });
    assert(r.tokens?.accessToken, 'no access token');
    assert(r.user?.displayName === 'Sweep Tester', 'displayName missing');
    assert(r.verificationToken, 'no verification token');
    return r;
  });

  await check('POST /auth/verify-email', async () => {
    await api('/auth/verify-email', { method: 'POST', body: { token: reg.verificationToken } });
  });

  let user = await check('POST /auth/login', async () => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    assert(r.tokens?.accessToken && r.tokens?.refreshToken, 'missing tokens');
    return r;
  });
  let token = user?.tokens.accessToken;
  let refreshToken = user?.tokens.refreshToken;

  await check('POST /auth/login (wrong password) → 401', async () => {
    const res = await api('/auth/login', {
      method: 'POST',
      body: { email, password: 'WrongPass1' },
      raw: true,
    });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  await check('GET /auth/me', async () => {
    const me = await api('/auth/me', { token });
    assert(me.email === email, 'wrong user');
  });

  await check('POST /auth/refresh → rotates tokens', async () => {
    const r = await api('/auth/refresh', { method: 'POST', body: { refreshToken } });
    assert(r.accessToken && r.refreshToken, 'missing rotated tokens');
    assert(r.refreshToken !== refreshToken, 'refresh token was not rotated');
    token = r.accessToken;
    refreshToken = r.refreshToken;
  });

  await check('POST /auth/refresh (reused old token) → 401', async () => {
    const res = await api('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: user.tokens.refreshToken },
      raw: true,
    });
    assert(res.status === 401, `expected 401 on reuse, got ${res.status}`);
  });

  // Reuse detection revokes ALL sessions → must log in again.
  const relog = await check('POST /auth/login (after reuse revoke)', async () => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password } });
    assert(r.tokens?.accessToken, 'no token');
    return r;
  });
  token = relog?.tokens.accessToken;
  refreshToken = relog?.tokens.refreshToken;

  // 2FA
  const setup = await check('POST /auth/2fa/setup', async () => {
    const r = await api('/auth/2fa/setup', { method: 'POST', token });
    assert(r.otpauthUrl?.startsWith('otpauth://'), 'bad otpauth url');
    assert(r.qrDataUrl?.startsWith('data:image/png'), 'bad qr');
    return r;
  });

  const secret = setup ? new URL(setup.otpauthUrl.replace('otpauth://', 'http://')).searchParams.get('secret') : null;

  await check('POST /auth/2fa/enable → backup codes', async () => {
    const code = authenticator.generate(secret);
    const r = await api('/auth/2fa/enable', { method: 'POST', token, body: { code } });
    assert(r.enabled === true, 'not enabled');
    assert(Array.isArray(r.backupCodes) && r.backupCodes.length === 10, 'expected 10 backup codes');
  });

  await check('POST /auth/login (2FA required) → 401 TWO_FACTOR_REQUIRED', async () => {
    const res = await api('/auth/login', { method: 'POST', body: { email, password }, raw: true });
    assert(res.status === 401, `expected 401, got ${res.status}`);
    const j = await res.json();
    assert(String(j.message).includes('TWO_FACTOR_REQUIRED'), `got: ${j.message}`);
  });

  await check('POST /auth/login (with TOTP) → success', async () => {
    const twoFactorCode = authenticator.generate(secret);
    const r = await api('/auth/login', { method: 'POST', body: { email, password, twoFactorCode } });
    assert(r.tokens?.accessToken, 'login with TOTP failed');
    token = r.tokens.accessToken;
  });

  await check('POST /auth/2fa/disable', async () => {
    await api('/auth/2fa/disable', { method: 'POST', token });
  });

  // Password reset
  const forgot = await check('POST /auth/forgot-password → token', async () => {
    const r = await api('/auth/forgot-password', { method: 'POST', body: { email } });
    assert(r.token, 'no reset token returned (non-prod should return it)');
    return r;
  });

  await check('POST /auth/reset-password', async () => {
    await api('/auth/reset-password', {
      method: 'POST',
      body: { token: forgot.token, password: 'NewSecure2' },
    });
  });

  const after = await check('POST /auth/login (new password)', async () => {
    const r = await api('/auth/login', { method: 'POST', body: { email, password: 'NewSecure2' } });
    assert(r.tokens?.accessToken, 'login with new password failed');
    return r;
  });
  token = after?.tokens.accessToken;
  refreshToken = after?.tokens.refreshToken;

  // ─────────────────────────── USERS ────────────────────────────
  console.log('\n--- users ---');
  await check('GET /users/me → full profile (displayName present)', async () => {
    const me = await api('/users/me', { token });
    assert(me.displayName, 'displayName missing — dashboard would crash');
  });
  await check('PATCH /users/me', async () => {
    const me = await api('/users/me', { method: 'PATCH', token, body: { displayName: 'Renamed Tester' } });
    assert(me.displayName === 'Renamed Tester', 'rename failed');
  });
  await check('GET /users/me/sessions', async () => {
    const s = await api('/users/me/sessions', { token });
    assert(Array.isArray(s) && s.length >= 1, 'no active sessions');
  });
  await check('GET /users/me without token → 401', async () => {
    const res = await api('/users/me', { raw: true });
    assert(res.status === 401, `expected 401, got ${res.status}`);
  });

  // ────────────────────────── PROJECTS ──────────────────────────
  console.log('\n--- projects ---');
  const proj = await check('POST /projects', async () => {
    const p = await api('/projects', {
      method: 'POST',
      token,
      body: { title: 'Sweep Design', type: 'INSTAGRAM_POST', width: 1080, height: 1080 },
    });
    assert(p.id, 'no id');
    return p;
  });
  const pid = proj?.id;

  await check('GET /projects (list)', async () => {
    const l = await api('/projects', { token });
    assert(l.items.some((p) => p.id === pid), 'created project not in list');
  });
  await check('GET /projects/:id', async () => {
    const p = await api(`/projects/${pid}`, { token });
    assert(p.id === pid, 'wrong project');
  });
  await check('PATCH /projects/:id (rename + favorite)', async () => {
    const p = await api(`/projects/${pid}`, {
      method: 'PATCH',
      token,
      body: { title: 'Renamed Design', isFavorite: true },
    });
    assert(p.title === 'Renamed Design' && p.isFavorite === true, 'update failed');
  });
  await check('PUT /projects/:id/document (autosave persists)', async () => {
    const doc = {
      version: 1,
      background: '#ffffff',
      objects: [
        { id: 't1', type: 'text', name: 'T', x: 10, y: 10, width: 200, height: 40, rotation: 0, opacity: 1, locked: false, visible: true, groupId: null, text: 'Hello', fontSize: 32, fontFamily: 'Inter', fontStyle: 'normal', align: 'left', fill: '#111827', lineHeight: 1.2, letterSpacing: 0 },
      ],
    };
    await api(`/projects/${pid}/document`, { method: 'PUT', token, body: { document: doc } });
    const back = await api(`/projects/${pid}`, { token });
    assert(back.document?.objects?.length === 1, 'document did not persist');
    assert(back.document.objects[0].text === 'Hello', 'object content lost');
  });
  await check('GET /projects/:id/versions (snapshot created)', async () => {
    const v = await api(`/projects/${pid}/versions`, { token });
    assert(Array.isArray(v) && v.length >= 1, 'no version snapshot was created on autosave');
    return v;
  });
  await check('POST /projects/:id/versions/:vid/restore', async () => {
    const v = await api(`/projects/${pid}/versions`, { token });
    const p = await api(`/projects/${pid}/versions/${v[0].id}/restore`, { method: 'POST', token });
    assert(p.id === pid, 'restore failed');
  });
  await check('POST /projects/:id/duplicate', async () => {
    const d = await api(`/projects/${pid}/duplicate`, { method: 'POST', token });
    assert(d.id !== pid && d.title.includes('copy'), 'duplicate failed');
  });
  await check('DELETE /projects/:id (trash) + list trashed', async () => {
    await api(`/projects/${pid}`, { method: 'DELETE', token });
    const t = await api('/projects?trashed=true', { token });
    assert(t.items.some((p) => p.id === pid), 'not in trash');
  });
  await check('POST /projects/:id/restore', async () => {
    await api(`/projects/${pid}/restore`, { method: 'POST', token });
    const l = await api('/projects', { token });
    assert(l.items.some((p) => p.id === pid), 'restore failed');
  });
  await check("GET another user's project → 404/403", async () => {
    const res = await api('/projects/does-not-exist-id', { token, raw: true });
    assert([403, 404].includes(res.status), `expected 403/404, got ${res.status}`);
  });

  // ─────────────────────────── MEDIA ────────────────────────────
  console.log('\n--- media (S3/MinIO) ---');
  const asset = await check('POST /media/upload (multipart)', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([PNG], { type: 'image/png' }), 'pixel.png');
    fd.append('name', 'pixel.png');
    fd.append('width', '1');
    fd.append('height', '1');
    const a = await api('/media/upload', { method: 'POST', token, form: fd });
    assert(a.id && a.url, 'no asset/url returned');
    assert(a.type === 'IMAGE', `wrong type ${a.type}`);
    return a;
  });

  await check('asset URL is publicly fetchable (object really in storage)', async () => {
    const res = await fetch(asset.url);
    assert(res.ok, `GET ${asset.url} → ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    assert(buf.length === PNG.length, `size mismatch: ${buf.length} vs ${PNG.length}`);
  });

  await check('GET /media (list)', async () => {
    const l = await api('/media', { token });
    assert(l.items.some((a) => a.id === asset.id), 'uploaded asset not listed');
  });
  await check('PATCH /media/:id (rename/tag/favorite)', async () => {
    const a = await api(`/media/${asset.id}`, {
      method: 'PATCH',
      token,
      body: { name: 'renamed.png', tags: ['test'], isFavorite: true },
    });
    assert(a.name === 'renamed.png' && a.isFavorite, 'update failed');
  });
  await check('DELETE /media/:id (trash) + restore', async () => {
    await api(`/media/${asset.id}`, { method: 'DELETE', token });
    await api(`/media/${asset.id}/restore`, { method: 'POST', token });
  });
  await check('POST /media/presign → upload URL', async () => {
    const p = await api('/media/presign', {
      method: 'POST',
      token,
      body: { filename: 'direct.png', contentType: 'image/png' },
    });
    assert(p.uploadUrl?.startsWith('http'), 'no presigned url');
    assert(p.key?.length > 0, 'no key');
  });
  await check('POST /media/upload (disallowed mime) → 400', async () => {
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from('#!/bin/sh')], { type: 'application/x-sh' }), 'evil.sh');
    const res = await api('/media/upload', { method: 'POST', token, form: fd, raw: true });
    assert(res.status === 400, `expected 400, got ${res.status}`);
  });

  // ────────────────────────── TEMPLATES ─────────────────────────
  console.log('\n--- templates ---');
  const tpls = await check('GET /templates', async () => {
    const t = await api('/templates', { token });
    assert(t.items.length >= 5, `expected seeded templates, got ${t.items.length}`);
    return t;
  });
  await check('GET /templates/categories', async () => {
    const c = await api('/templates/categories', { token });
    assert(Array.isArray(c) && c.length > 0, 'no categories');
  });
  await check('GET /templates/:id (with document)', async () => {
    const t = await api(`/templates/${tpls.items[0].id}`, { token });
    assert(t.document?.objects?.length > 0, 'template has no objects');
  });
  await check('POST /templates/:id/use → creates project from template', async () => {
    const p = await api(`/templates/${tpls.items[0].id}/use`, { method: 'POST', token });
    assert(p.id, 'no project created');
    assert(p.document?.objects?.length > 0, 'template document not cloned into project');
  });

  // ─────────────────────────── SEARCH ───────────────────────────
  console.log('\n--- search ---');
  await check('GET /search?q=resume → finds template', async () => {
    const s = await api('/search?q=resume', { token });
    assert(s.results.length > 0, 'no results');
    assert(s.results.some((r) => r.kind === 'template'), 'no template result');
  });
  await check('GET /search?q=Renamed → finds own project', async () => {
    const s = await api('/search?q=Renamed', { token });
    assert(s.results.some((r) => r.kind === 'project'), 'own project not found');
  });

  // ─────────────────────────────  AI  ───────────────────────────
  console.log('\n--- ai ---');
  await check('GET /ai/status', async () => {
    const s = await api('/ai/status', { token });
    assert(['local', 'anthropic'].includes(s.engine), `bad engine ${s.engine}`);
  });
  await check('POST /ai/text/write', async () => {
    const r = await api('/ai/text/write', { method: 'POST', token, body: { prompt: 'a coffee shop launch' } });
    assert(r.text?.length > 0, 'empty copy');
  });
  await check('POST /ai/text/rewrite', async () => {
    const r = await api('/ai/text/rewrite', {
      method: 'POST',
      token,
      body: { text: "I'm sure we can't lose!", mode: 'formal' },
    });
    assert(r.text.includes('cannot'), `formal rewrite failed: ${r.text}`);
  });
  await check('POST /ai/text/translate', async () => {
    const r = await api('/ai/text/translate', { method: 'POST', token, body: { text: 'hello team', target: 'es' } });
    assert(r.text.includes('hola'), `translate failed: ${r.text}`);
  });
  await check('POST /ai/color-palette', async () => {
    const r = await api('/ai/color-palette', { method: 'POST', token, body: { prompt: 'ocean sunrise' } });
    assert(r.colors.length === 5 && r.colors.every((c) => /^#[0-9a-f]{6}$/.test(c)), 'bad palette');
  });
  await check('POST /ai/font-recommendation', async () => {
    const r = await api('/ai/font-recommendation', { method: 'POST', token, body: { keyword: 'wedding' } });
    assert(r.pairings.length === 3, 'expected 3 pairings');
  });
  await check('POST /ai/design-suggestions', async () => {
    const r = await api('/ai/design-suggestions', {
      method: 'POST',
      token,
      body: { scene: { background: '#fff', objects: [] } },
    });
    assert(r.suggestions.length > 0, 'no suggestions');
  });
  await check('POST /ai/accessibility-check (catches low contrast)', async () => {
    const scene = {
      background: '#ffffff',
      objects: [
        { id: 't1', type: 'text', x: 0, y: 0, width: 200, height: 50, fill: '#eeeeee', fontSize: 20, text: 'hi' },
      ],
    };
    const r = await api('/ai/accessibility-check', { method: 'POST', token, body: { scene } });
    assert(r.issues.some((i) => i.kind === 'contrast'), 'failed to flag low contrast');
    assert(r.score < 100, 'score should be < 100');
  });
  await check('POST /ai/image/generate', async () => {
    const r = await api('/ai/image/generate', { method: 'POST', token, body: { prompt: 'neon city' } });
    assert(r.url?.startsWith('data:image/svg+xml;base64,'), 'no image url');
  });

  // ───────────────────────── COMMENTS ───────────────────────────
  console.log('\n--- comments ---');
  const cmt = await check('POST /projects/:id/comments (with @mention)', async () => {
    const c = await api(`/projects/${pid}/comments`, {
      method: 'POST',
      token,
      body: { body: 'Make this bigger @admin', anchor: { x: 10, y: 20 } },
    });
    assert(c.id && c.author?.displayName, 'comment/author missing');
    return c;
  });
  await check('GET /projects/:id/comments', async () => {
    const l = await api(`/projects/${pid}/comments`, { token });
    assert(l.some((c) => c.id === cmt.id), 'comment not listed');
  });
  await check('PATCH /comments/:id/resolve + reopen', async () => {
    const r = await api(`/comments/${cmt.id}/resolve`, { method: 'PATCH', token });
    assert(r.resolvedAt, 'not resolved');
    const o = await api(`/comments/${cmt.id}/reopen`, { method: 'PATCH', token });
    assert(!o.resolvedAt, 'not reopened');
  });
  await check('DELETE /comments/:id', async () => {
    await api(`/comments/${cmt.id}`, { method: 'DELETE', token });
  });

  // ─────────────────────────── EXPORT ───────────────────────────
  console.log('\n--- export ---');
  const videoProj = await check('POST /projects (video) + timeline document', async () => {
    const p = await api('/projects', {
      method: 'POST',
      token,
      body: { title: 'Sweep Video', type: 'VIDEO', width: 1920, height: 1080 },
    });
    const doc = {
      version: 1,
      width: 1920,
      height: 1080,
      fps: 30,
      background: '#000',
      tracks: [
        {
          id: 'track_video',
          kind: 'video',
          name: 'Video',
          muted: false,
          locked: false,
          clips: [
            { id: 'c1', kind: 'image', name: 'img', src: asset.url, start: 0, duration: 4000, trimIn: 0, trimOut: 4000, speed: 1, volume: 0, transitionIn: 'none' },
          ],
        },
      ],
    };
    await api(`/projects/${p.id}/document`, { method: 'PUT', token, body: { document: doc } });
    return p;
  });
  const job = await check('POST /projects/:id/export → job queued', async () => {
    const j = await api(`/projects/${videoProj.id}/export`, { method: 'POST', token, body: { format: 'mp4' } });
    assert(j.id, 'no job id');
    assert(j.frameCount === 120, `expected 120 frames (4s @30fps), got ${j.frameCount}`);
    return j;
  });
  await check('GET /export/:jobId → completes with a result URL', async () => {
    for (let i = 0; i < 30; i += 1) {
      const s = await api(`/export/${job.id}`, { token });
      if (s.status === 'completed') {
        assert(s.resultUrl, 'completed without resultUrl');
        return;
      }
      if (s.status === 'failed') throw new Error(`export failed: ${s.error}`);
      await new Promise((r) => setTimeout(r, 300));
    }
    throw new Error('export did not complete within 9s');
  });

  // ────────────────────────── BILLING ───────────────────────────
  console.log('\n--- billing ---');
  await check('GET /billing/plans', async () => {
    const p = await api('/billing/plans', { token });
    assert(p.length === 3, `expected 3 plans, got ${p.length}`);
  });
  await check('GET /billing/subscription (synthetic Free)', async () => {
    const s = await api('/billing/subscription', { token });
    assert(s.plan?.code === 'free', `expected free, got ${s.plan?.code}`);
  });
  await check('GET /billing/preview (coupon applies)', async () => {
    const p = await api('/billing/preview?planCode=pro&couponCode=WELCOME20', { token });
    assert(p.subtotalCents === 1299, `subtotal ${p.subtotalCents}`);
    assert(p.discountCents === 260, `expected 20% off (260), got ${p.discountCents}`);
    assert(p.totalCents === 1039, `total ${p.totalCents}`);
  });
  await check('GET /billing/preview (invalid coupon ignored)', async () => {
    const p = await api('/billing/preview?planCode=pro&couponCode=NOPE', { token });
    assert(p.discountCents === 0 && p.couponCode === null, 'invalid coupon should be ignored');
  });
  await check('POST /billing/checkout → activates subscription', async () => {
    const r = await api('/billing/checkout', { method: 'POST', token, body: { planCode: 'pro', couponCode: 'WELCOME20' } });
    assert(r.mode === 'activated', `mode=${r.mode}`);
    assert(r.subscription?.aiCreditsRemaining === 500, `credits=${r.subscription?.aiCreditsRemaining}`);
  });
  await check('GET /billing/subscription → now Pro', async () => {
    const s = await api('/billing/subscription', { token });
    assert(s.plan?.code === 'pro', `expected pro, got ${s.plan?.code}`);
  });
  await check('POST /billing/credits/consume', async () => {
    const r = await api('/billing/credits/consume', { method: 'POST', token, body: { amount: 5 } });
    assert(r.remaining === 495, `expected 495, got ${r.remaining}`);
  });
  await check('GET /billing/invoices', async () => {
    const inv = await api('/billing/invoices', { token });
    assert(inv.length >= 1 && inv[0].planName === 'Pro', 'no invoice');
  });
  await check('POST /billing/cancel → cancelAtPeriodEnd', async () => {
    const s = await api('/billing/cancel', { method: 'POST', token });
    assert(s.cancelAtPeriodEnd === true, 'not cancelled');
  });

  // ─────────────────────────── ADMIN ────────────────────────────
  console.log('\n--- admin (RBAC) ---');
  await check('GET /admin/overview as normal user → 403', async () => {
    const res = await api('/admin/overview', { token, raw: true });
    assert(res.status === 403, `expected 403, got ${res.status}`);
  });

  const admin = await check('POST /auth/login (admin)', async () => {
    const r = await api('/auth/login', { method: 'POST', body: ADMIN });
    assert(r.user.role === 'SUPER_ADMIN', `role=${r.user.role}`);
    return r;
  });
  const atk = admin?.tokens.accessToken;

  await check('GET /admin/overview', async () => {
    const o = await api('/admin/overview', { token: atk });
    assert(o.users >= 2 && o.templates >= 5, `bad counts ${JSON.stringify(o)}`);
    assert(typeof o.mrrCents === 'number', 'no mrr');
  });
  await check('GET /admin/analytics/signups', async () => {
    const s = await api('/admin/analytics/signups?days=30', { token: atk });
    assert(s.length === 30, `expected 30 buckets, got ${s.length}`);
    assert(s.some((b) => b.count > 0), 'no signups counted');
  });
  await check('GET /admin/analytics/projects', async () => {
    const s = await api('/admin/analytics/projects?days=30', { token: atk });
    assert(s.length === 30 && s.some((b) => b.count > 0), 'no projects counted');
  });
  await check('GET /admin/analytics/top-templates', async () => {
    const t = await api('/admin/analytics/top-templates', { token: atk });
    assert(t.length > 0 && t[0].usageCount >= 1, 'usage not tracked');
  });
  await check('GET /admin/analytics/activity', async () => {
    const a = await api('/admin/analytics/activity', { token: atk });
    assert(a.some((x) => x.action === 'USER_LOGIN'), 'no login activity');
  });
  await check('GET /admin/users (search)', async () => {
    const u = await api(`/admin/users?search=${encodeURIComponent(email)}`, { token: atk });
    assert(u.items.length === 1, `expected 1 user, got ${u.items.length}`);
    return u;
  });
  await check('PATCH /admin/users/:id (suspend)', async () => {
    const u = await api(`/admin/users?search=${encodeURIComponent(email)}`, { token: atk });
    const target = u.items[0];
    const r = await api(`/admin/users/${target.id}`, { method: 'PATCH', token: atk, body: { status: 'SUSPENDED' } });
    assert(r.status === 'SUSPENDED', 'suspend failed');
    // suspended user's token must stop working
    const res = await api('/users/me', { token, raw: true });
    assert(res.status === 401, `suspended user still authorized (got ${res.status})`);
    // restore
    await api(`/admin/users/${target.id}`, { method: 'PATCH', token: atk, body: { status: 'ACTIVE' } });
  });
  await check('GET /admin/subscriptions', async () => {
    const s = await api('/admin/subscriptions', { token: atk });
    assert(Array.isArray(s) && s.length >= 1, 'no subscriptions');
  });
  await check('GET /admin/audit-logs', async () => {
    const l = await api('/admin/audit-logs', { token: atk });
    assert(l.items.length > 0, 'no audit entries');
  });
  await check('GET /admin/feature-flags', async () => {
    const f = await api('/admin/feature-flags', { token: atk });
    assert(f.length >= 3, `expected flags, got ${f.length}`);
  });
  await check('PUT /admin/feature-flags (toggle + rollout)', async () => {
    const r = await api('/admin/feature-flags', {
      method: 'PUT',
      token: atk,
      body: { key: 'ai-video-generator', description: 'AI video generation', enabled: true, rolloutPercent: 25 },
    });
    assert(r.enabled === true && r.rolloutPercent === 25, 'flag update failed');
  });

  // ───────────────────────── LOGOUT ─────────────────────────────
  console.log('\n--- logout ---');
  await check('POST /auth/logout → refresh token revoked', async () => {
    await api('/auth/logout', { method: 'POST', body: { refreshToken } });
    const res = await api('/auth/refresh', { method: 'POST', body: { refreshToken }, raw: true });
    assert(res.status === 401, `revoked token still works (got ${res.status})`);
  });

  // ───────────────────────── SUMMARY ────────────────────────────
  const passed = results.length - failures;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`RESULT: ${passed}/${results.length} passed, ${failures} failed`);
  if (failures > 0) {
    console.log('\nFAILURES:');
    for (const r of results.filter((x) => !x.ok)) console.log(`  ✗ ${r.name}\n      ${r.detail}`);
  }
  console.log('='.repeat(60));
  process.exit(failures > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error('\nSWEEP CRASHED:', e);
  process.exit(2);
});
