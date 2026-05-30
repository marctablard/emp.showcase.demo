/**
 * E2E proof for **AC #1** (EMP-16 Phase G): when the primary CMS space is
 * empty, the default-content fallback composite must render the
 * version-controlled showcase content (the `_default_` tree under
 * `src/data/cms/_default_`) instead of a blank page shell.
 *
 * Setup the tester provides (mirrors the opt-in gating of
 * `cms-no-token.spec.ts` / `auth-site-sync.spec.ts`):
 *   E2E_CMS_COMPOSITE_FALLBACK=true
 *   NEXT_PUBLIC_CMS_PROVIDER=none          # primary always misses
 *   NEXT_PUBLIC_CMS_FALLBACK_PROVIDER=mock # composite wraps with the local _default_ source
 * then boots `next start`.
 *
 * Why `NEXT_PUBLIC_CMS_PROVIDER=none` rather than a real empty Storyblok space:
 * the mechanic under test is "primary returns { notfound } ⇒ composite delegates
 * to the `_default_` local source ⇒ showcase content renders". An empty Storyblok
 * space and a `none` primary exercise the IDENTICAL composite path
 * (`FallbackCmsAdapter.getPage` sees `{ notfound: true }` either way), but `none`
 * is hermetic — no dependency on the live state of an external Storyblok space,
 * so the smoke can never go flaky-red on someone repopulating the demo space.
 *
 * The headline asserted below exists ONLY in `src/data/cms/_default_/{de,en}/home.json`.
 * If the composite layer were absent (primary `none` binding directly), the home
 * route would render an empty shell and this text would never appear — so the
 * assertion fails closed if the fallback wrap is lost on the render graph.
 */
import { expect, test } from '@playwright/test';

test.describe('CMS — composite default-content fallback', () => {
  test.skip(
    process.env.E2E_CMS_COMPOSITE_FALLBACK !== 'true',
    'Set E2E_CMS_COMPOSITE_FALLBACK=true (with NEXT_PUBLIC_CMS_PROVIDER=none + ' +
      'NEXT_PUBLIC_CMS_FALLBACK_PROVIDER=mock) to run the AC#1 composite-fallback check.',
  );

  test('renders _default_ showcase content on the homepage when the primary space is empty', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (err) => {
      pageErrors.push(err.message);
    });

    const response = await page.goto('/');
    expect(response?.status()).toBe(200);

    // Page shell rendered without a boot crash.
    await expect(page).toHaveTitle(/Emporix/i);
    expect(pageErrors).toEqual([]);

    // The decisive assertion: the `_default_` home headline must be on the page.
    // It is served EXCLUSIVELY by the local fallback source via the composite —
    // its presence proves the fallback wrap delegated and rendered showcase
    // content rather than an empty shell. Locale-agnostic (de or en home).
    const fallbackHeadline = page.getByText(/Welcome to our Online Shop|Willkommen in unserem Online-Shop/i);
    await expect(fallbackHeadline.first()).toBeVisible();
  });
});
