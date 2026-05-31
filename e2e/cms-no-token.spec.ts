/**
 * E2E proof for **AC #1**: the app must boot, serve the homepage with a 200
 * response, and emit no `access-token`-related console errors when
 * `NEXT_STORYBLOK_ACCESS_TOKEN` is empty.
 *
 * Mechanic: tester starts `next start` with the token unset and
 * `E2E_CMS_NO_TOKEN=true`. This suite is gated on `E2E_CMS_NO_TOKEN` so it
 * is skipped in default runs (mirrors the `auth-site-sync.spec.ts` opt-in
 * pattern).
 *
 * Why an E2E (not a unit test): the regression is "module-load-time crash from
 * `storyblokInit()` in `src/lib/storyblok.ts`". Only a real `next start` boot
 * proves the crash is gone.
 */
import { expect, test } from '@playwright/test';

test.describe('CMS — no Storyblok token', () => {
  test.skip(
    process.env.E2E_CMS_NO_TOKEN !== 'true',
    'Set E2E_CMS_NO_TOKEN=true (with NEXT_STORYBLOK_ACCESS_TOKEN unset) to run the AC#1 boot check.',
  );

  test('homepage serves a 200 and renders the page shell without Storyblok-token errors', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const response = await page.goto('/');

    expect(response?.status()).toBe(200);

    // Page shell rendered — title comes from i18n via async `generateMetadata`,
    // so a non-empty Emporix title proves the server-render pipeline succeeded
    // without a Storyblok token. Title is race-free (no CSS animation visibility
    // gating), whereas `<header>` locators are showcase-specific and brittle.
    await expect(page).toHaveTitle(/Emporix/i);

    // No fatal page errors at all — module-load crash from storyblokInit is gone.
    expect(pageErrors).toEqual([]);

    // No Storyblok-token-related console errors. Other unrelated errors
    // (transient network warnings, etc.) are tolerated; the token-absence
    // path must be silent.
    const tokenErrors = consoleErrors.filter((line) => /access[ _-]?token|storyblok/i.test(line));
    expect(tokenErrors).toEqual([]);
  });
});
