/**
 * E2E acceptance for **EMP-15 Phase F** (deferred via EMP-20): the
 * provider-agnostic CMS preview route at
 * `src/app/preview/[site]/[locale]/[[...slug]]/page.tsx`.
 *
 * What `npm run jest` CANNOT prove and this suite does: that a real Next.js
 * boot serves the preview URL shapes with the correct HTTP status — that every
 * rejection path falls through to a genuine `notFound()` (404) instead of
 * rendering a draft page.
 *
 * ── Gating (opt-in, mirrors `cms-no-token.spec.ts` / `auth-site-sync.spec.ts`) ──
 *   • `E2E_PREVIEW=true` enables the suite at all.
 *   • `E2E_PREVIEW_PROVIDER` tells the spec which provider the harness booted
 *     the dev/start server under (`storyblok` | `none` | `mock`). It is REQUIRED
 *     context, not a convenience: the provider is resolved at request time from
 *     the server process env (`resolveCmsProvider`), so a single server boot is
 *     pinned to one provider. The AC's "11 States × 3 BUILD_IDs" is satisfied by
 *     running this suite once per provider boot.
 *
 * ── Why STEP 1 needs NO secrets ──
 *   The Storyblok rejection states never reach a network fetch:
 *     1–4  reject at the pure edge detector (`isStoryblokPreviewRequest`) —
 *          missing keys / out-of-window timestamp → adapter returns `null`.
 *     5    rejects at the adapter's space-id MISMATCH, which runs BEFORE the
 *          draft fetch. `NEXT_STORYBLOK_SPACE_ID` is a PUBLIC identifier
 *          (not a secret); the harness sets it to a known dummy and this spec
 *          sends a deliberately different `_storyblok_tk[space_id]`.
 *
 * ── STEP 3 (inside-valid + happy-path) ──
 *   Lives in the final describe, gated on `E2E_PREVIEW_SIGNED_URL`. It needs a
 *   real Storyblok signed preview URL (space-id match + live DRAFT fetch inside
 *   the `now-3600..now+60` window) and is `test.skip()`-ed until the board
 *   provides credentials (EMP-20 STEP 3 blocker).
 */
import { expect, test } from '@playwright/test';

const PREVIEW_ENABLED = process.env.E2E_PREVIEW === 'true';
const PROVIDER = (process.env.E2E_PREVIEW_PROVIDER ?? '').trim();

/** Preview URL under test. Site/locale are opaque to the route (it lives
 * outside the `[site]/[locale]` group) — they are only forwarded to the
 * adapter, so any non-empty pair exercises the same dispatch. */
const PREVIEW_PATH = '/preview/main/en/home';

const STORYBLOK_KEY = '_storyblok';
const TIMESTAMP_KEY = '_storyblok_tk[timestamp]';
const TOKEN_KEY = '_storyblok_tk[token]';
const SPACE_ID_KEY = '_storyblok_tk[space_id]';

/** Current unix epoch second — matches the detector's `Math.floor(Date.now()/1000)`. */
function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Builds a `/preview/...` URL with a Storyblok signed-preview query.
 * `overrides` replaces individual signals; `omit` drops keys entirely.
 * `URLSearchParams` symmetrically encodes the bracketed keys so Next parses
 * them back to their literal form (`_storyblok_tk[timestamp]`, …).
 */
function previewUrl(overrides: Partial<Record<string, string>> = {}, omit: string[] = []): string {
  const base: Record<string, string> = {
    [STORYBLOK_KEY]: '',
    [TIMESTAMP_KEY]: String(nowSeconds()),
    [TOKEN_KEY]: 'irrelevant-hmac-token-content-not-validated',
    [SPACE_ID_KEY]: '338074',
  };
  const merged: Record<string, string | undefined> = { ...base, ...overrides };
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(merged)) {
    if (omit.includes(key) || value === undefined) continue;
    params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${PREVIEW_PATH}?${qs}` : PREVIEW_PATH;
}

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 · non-preview providers (none / mock) — every URL shape → 404
// ─────────────────────────────────────────────────────────────────────────────
test.describe('preview route — non-preview provider always 404 (none/mock)', () => {
  test.skip(
    !PREVIEW_ENABLED || (PROVIDER !== 'none' && PROVIDER !== 'mock'),
    'Set E2E_PREVIEW=true and boot the server with NEXT_CMS_PROVIDER=none|mock, then E2E_PREVIEW_PROVIDER=none|mock.',
  );

  test('bare preview URL → 404 (no preview adapter bound)', async ({ page }) => {
    const response = await page.goto(PREVIEW_PATH);
    expect(response?.status()).toBe(404);
  });

  test('a fully-signed, in-window URL still → 404 (adapter absence wins over params)', async ({ page }) => {
    // Proves params can never resurrect a preview under a non-storyblok
    // provider: the registry returns no adapter → `notFound()` regardless.
    const response = await page.goto(previewUrl());
    expect(response?.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 1 · storyblok rejection states — 5 × 404 (no secrets, no fetch)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('preview route — storyblok rejection states → 404', () => {
  test.skip(
    !PREVIEW_ENABLED || PROVIDER !== 'storyblok',
    'Set E2E_PREVIEW=true, boot with NEXT_CMS_PROVIDER=storyblok (+ dummy NEXT_STORYBLOK_SPACE_ID, no token needed), then E2E_PREVIEW_PROVIDER=storyblok.',
  );

  // The dummy space id the harness configured (NEXT_STORYBLOK_SPACE_ID).
  // Default matches the real Emporix-Showcase Storyblok space (verified via
  // `https://api.storyblok.com/v2/cdn/spaces/me?token=<demo-token>` → 338074),
  // so a STEP-3 run that boots with the repo demo token doesn't need to
  // re-configure this. State 5 still sends a guaranteed-different value so the
  // mismatch branch fires.
  const configuredSpaceId = (process.env.E2E_PREVIEW_SPACE_ID ?? '338074').trim();

  test('state 1 — no signed params → detector rejects → 404', async ({ page }) => {
    const response = await page.goto(PREVIEW_PATH);
    expect(response?.status()).toBe(404);
  });

  test('state 2 — expired timestamp (now-3601) → detector rejects → 404', async ({ page }) => {
    const response = await page.goto(previewUrl({ [TIMESTAMP_KEY]: String(nowSeconds() - 3601) }));
    expect(response?.status()).toBe(404);
  });

  test('state 3 — future timestamp (now+61) → detector rejects → 404', async ({ page }) => {
    const response = await page.goto(previewUrl({ [TIMESTAMP_KEY]: String(nowSeconds() + 61) }));
    expect(response?.status()).toBe(404);
  });

  test('state 4 — missing _storyblok_tk[token] key → detector rejects → 404', async ({ page }) => {
    const response = await page.goto(previewUrl({}, [TOKEN_KEY]));
    expect(response?.status()).toBe(404);
  });

  test('state 5 — wrong _storyblok_tk[space_id] → adapter space-id mismatch → 404 (pre-fetch)', async ({ page }) => {
    // Valid presence + in-window ts ⇒ passes the pure edge detector, then the
    // adapter rejects on space-id mismatch BEFORE any draft fetch. No token.
    const response = await page.goto(previewUrl({ [SPACE_ID_KEY]: `${configuredSpaceId}-MISMATCH` }));
    expect(response?.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STEP 3 · inside-valid + happy-path — BLOCKED on Storyblok signed-URL secrets
// ─────────────────────────────────────────────────────────────────────────────
test.describe('preview route — inside-valid happy path (signed)', () => {
  const signedUrl = process.env.E2E_PREVIEW_SIGNED_URL;

  test.skip(
    !PREVIEW_ENABLED || !signedUrl,
    'EMP-20 STEP 3 blocker: provide a real Storyblok signed preview URL via E2E_PREVIEW_SIGNED_URL (space-id match + live DRAFT inside now-3600..now+60).',
  );

  test('a valid signed preview URL renders the DRAFT page (200) with the Visual-Editor bridge', async ({ page }) => {
    // The board-supplied `E2E_PREVIEW_SIGNED_URL` is a full path+query already
    // inside the validity window and matching the configured space id.
    const response = await page.goto(signedUrl as string);
    expect(response?.status()).toBe(200);

    // The Storyblok bridge script is the static, deterministic proof that the
    // preview adapter (not the published shell) rendered this response.
    await expect(page.locator('script[src*="app.storyblok.com"], script[src*="storyblok"]').first()).toBeAttached();
  });
});
