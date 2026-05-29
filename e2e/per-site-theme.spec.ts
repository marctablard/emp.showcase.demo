/**
 * Browser smoke for **EMP-13 Phase D — Per-Site-Theming** (acceptance criteria
 * verified at the computed-style level, which only a real browser can prove).
 *
 * What this proves
 * ----------------
 * 1. **AC c** — three sites render three different `--color-surface-action`
 *    values (`main` → #1d4ed8, `us-branch` → #b91c1c, `showcase` → #047857),
 *    read via `getComputedStyle(document.documentElement)`.
 * 2. **Default fallback (no cascade)** — a site without an explicit theme file
 *    resolves to the (empty) `_default_.css` and shows NONE of the per-site
 *    overrides: `--color-surface-action` falls back to the `mapped.css` default
 *    (`var(--color-primary-500)`), so an un-themed site can never inherit
 *    another site's accent.
 * 3. **Architect cascade nit** — the theme `<link>` mounted as the FIRST
 *    `<body>` child wins the `:root` tokens over the `globals.css` injected into
 *    `<head>`. Asserted by computed value (not markup): the site override
 *    differs from the `globals.css`/`mapped.css` default.
 *
 * Why two layers of coverage
 * --------------------------
 * `NEXT_PUBLIC_AVAILABLE_SITES` is `main,us-branch`, so the site middleware
 * (`src/site/middleware.ts`) only treats those two path segments as sites.
 * `showcase` and a theme-less site are therefore NOT reachable as routes in the
 * default config. Coverage is split:
 *
 *  - **Real-route integration** (`describe` #1) for the two reachable sites
 *    (`/` = main, `/us-branch`). This exercises the genuine render path:
 *    `SiteThemeStyle` (a server component) emits the `<link rel="stylesheet"
 *    data-site-theme>` as the first `<body>` child, and we read the computed
 *    token off the live document root — exactly the AC mechanic.
 *
 *  - **Production-mount reproduction** (`describe` #2) for ALL four theme files
 *    against the real loaded `/` document (real `globals.css` in `<head>`). We
 *    re-create the exact production mount — remove the existing
 *    `[data-site-theme]` link and insert `<link href="/themes/<file>.css">` as
 *    the first `<body>` child — then read the computed token. This is what
 *    covers `showcase` and `_default_`, which have no reachable route.
 *
 * The reproduction is anchored to reality: `main` and `us-branch` are checked
 * BOTH via real route and via the mount reproduction, and the two must agree.
 * That agreement is what licenses using the reproduction for `showcase` and
 * `_default_`.
 *
 * Runs against the Playwright `webServer` (npm run dev) — no extra env gating,
 * it needs only the dev server + the Emporix backend that every page render
 * already depends on (same precondition as `homepage.spec.ts`).
 */
import { type Page, expect, test } from '@playwright/test';

/** Per-site action-surface accents — the literal hex each theme file sets. */
const SITE_ACCENT = {
  main: '#1d4ed8',
  'us-branch': '#b91c1c',
  showcase: '#047857',
} as const;

const THEME_HREF = {
  main: '/themes/main.css',
  'us-branch': '/themes/us-branch.css',
  showcase: '/themes/showcase.css',
  _default_: '/themes/_default_.css',
} as const;

const ALL_SITE_ACCENTS = Object.values(SITE_ACCENT);

/** Raw computed value of a custom property on the document root. */
function readRootToken(page: Page, prop = '--color-surface-action'): Promise<string> {
  return page.evaluate((p) => getComputedStyle(document.documentElement).getPropertyValue(p).trim(), prop);
}

/**
 * Resolve a CSS color expression to its final `rgb(...)` via a throwaway probe
 * element. Unlike reading a custom property directly, this forces `var()`
 * substitution and gives a deterministic, cross-browser-comparable value — used
 * to prove the default fallback resolves to exactly the `mapped.css` default.
 */
function resolveColor(page: Page, expr: string): Promise<string> {
  return page.evaluate((e) => {
    const probe = document.createElement('span');
    probe.style.color = e;
    document.body.appendChild(probe);
    const resolved = getComputedStyle(probe).color;
    probe.remove();
    return resolved;
  }, expr);
}

/**
 * Reproduce the production theme mount: drop any existing `[data-site-theme]`
 * link and insert `<link rel="stylesheet" href>` as the FIRST `<body>` child —
 * byte-for-byte what `SiteThemeStyle` emits — then await the stylesheet load so
 * the computed cascade is settled before assertions.
 */
async function mountThemeLink(page: Page, href: string, siteCode: string): Promise<void> {
  await page.evaluate(
    ({ href, siteCode }) =>
      new Promise<void>((resolve, reject) => {
        document.querySelectorAll('link[data-site-theme]').forEach((l) => l.remove());
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        link.setAttribute('data-site-theme', siteCode);
        document.body.insertBefore(link, document.body.firstChild);
        if (link.sheet) {
          resolve();
          return;
        }
        link.addEventListener('load', () => resolve(), { once: true });
        link.addEventListener('error', () => reject(new Error(`theme stylesheet failed to load: ${href}`)), {
          once: true,
        });
      }),
    { href, siteCode },
  );
}

test.describe('Per-site theming — real-route integration', () => {
  test('main (/) renders the main action surface and the body-link beats the head default', async ({ page }) => {
    await page.goto('/');
    // The server-rendered theme link is the first <body> child for site `main`.
    await expect(page.locator('link[data-site-theme="main"]')).toHaveAttribute('href', THEME_HREF.main);

    expect(await readRootToken(page)).toBe(SITE_ACCENT.main);

    // Cascade proof: the first-body-child link overrode the `globals.css`
    // (mapped) default injected into <head>. Resolved colors must differ.
    const mappedDefault = await resolveColor(page, 'var(--color-primary-500)');
    const surfaceAction = await resolveColor(page, 'var(--color-surface-action)');
    expect(surfaceAction).not.toBe(mappedDefault);
  });

  test('us-branch (/us-branch) renders a distinct action surface', async ({ page }) => {
    await page.goto('/us-branch');
    await expect(page.locator('link[data-site-theme="us-branch"]')).toHaveAttribute('href', THEME_HREF['us-branch']);

    expect(await readRootToken(page)).toBe(SITE_ACCENT['us-branch']);
  });
});

test.describe('Per-site theming — production mount across all four theme files', () => {
  test.beforeEach(async ({ page }) => {
    // A real document with the real `globals.css` (mapped default) in <head>.
    await page.goto('/');
  });

  for (const site of ['main', 'us-branch', 'showcase'] as const) {
    test(`${site}.css applied as first body child wins the cascade → ${SITE_ACCENT[site]}`, async ({ page }) => {
      const mappedDefault = await resolveColor(page, 'var(--color-primary-500)');

      await mountThemeLink(page, THEME_HREF[site], site);

      // AC c: each site yields its own literal accent on the document root.
      expect(await readRootToken(page)).toBe(SITE_ACCENT[site]);

      // Architect nit: the body-child link beat the head `globals.css` default.
      const surfaceAction = await resolveColor(page, 'var(--color-surface-action)');
      expect(surfaceAction).not.toBe(mappedDefault);
    });
  }

  test('_default_.css falls back to the mapped default and shows NONE of the per-site overrides', async ({ page }) => {
    // Mapped default is, by definition, `--color-surface-action: var(--color-primary-500)`.
    const mappedDefault = await resolveColor(page, 'var(--color-primary-500)');

    await mountThemeLink(page, THEME_HREF._default_, '_default_');

    // No per-site override leaked through: the raw token is none of the three accents.
    const raw = await readRootToken(page);
    expect(ALL_SITE_ACCENTS).not.toContain(raw);

    // Positive proof: surface-action resolves to exactly the mapped default,
    // i.e. the empty `_default_.css` adds zero `:root` overrides.
    const surfaceAction = await resolveColor(page, 'var(--color-surface-action)');
    expect(surfaceAction).toBe(mappedDefault);
  });
});
