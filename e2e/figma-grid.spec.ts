import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

/**
 * Figma grid contract, verified against the rendered app (SHOW-320).
 *
 * The SOLL values below are measured from the Figma file `TYdPJprCUxuqn564qa9urk`
 * ("B2B New Showcase"), page "Grid" (`416:8805`). They are checked in deliberately rather
 * than fetched live: CI has no Figma access, and the Figma MCP is quota-limited. Each entry
 * carries the frame it came from, so a spec change can be re-verified at the source.
 *
 * Unlike `src/lib/figma-alignment.test.ts` (which locks utility classes in the source) and
 * `src/lib/content-container.test.ts` (which locks the compiled CSS rule), this suite asserts
 * the geometry the user actually sees, after cascade and media queries have resolved.
 *
 * Deliberately NOT a screenshot diff: the local app renders real backend data (empty PLP,
 * Storyblok-less homepage) against Figma's design dummies, so a pixel comparison would be
 * noise. Geometry is the part of the design that is objectively specified.
 */

/** Side margin per breakpoint band — from the five Figma grid frames. */
const GRID = [
  { w: 360, margin: 16, frame: 'Default Mobile max-width-767 (483:76)' },
  { w: 767, margin: 16, frame: 'Default Mobile max-width-767 (483:76)' },
  { w: 768, margin: 16, frame: 'sm | Tablet min-width-768 (483:2)' },
  { w: 1023, margin: 16, frame: 'sm | Tablet min-width-768 (483:2)' },
  { w: 1024, margin: 36, frame: 'md | Desktop min-width-1024 (420:10335)' },
  { w: 1279, margin: 36, frame: 'md | Desktop min-width-1024 (420:10335)' },
  { w: 1280, margin: 36, frame: 'lg | Desktop min-width-1280 (5261:65035)' },
  { w: 1920, margin: 36, frame: 'Atoms / Grid-Desktop-max (lg) (463:11124)' },
] as const;

/** Content is capped at 1848 (1920 − 2×36); beyond that the container centers. */
const MAX_CONTENT = 1848;

const HEADER = 'div.fixed.top-0.max-w-6xl';
const CONTENT = '.content-container';

/** Left edge of an element's content box (border-box left + padding-left). */
async function contentBoxLeft(page: Page, selector: string): Promise<number | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return Math.round(rect.left + parseFloat(getComputedStyle(el).paddingLeft));
  }, selector);
}

async function contentBoxWidth(page: Page, selector: string): Promise<number | null> {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return Math.round(rect.width - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
  }, selector);
}

test.describe('Figma grid — content container side margins', () => {
  for (const { w, margin, frame } of GRID) {
    test(`@${w}px the content container keeps ${margin}px side margin (${frame})`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/de/browse', { waitUntil: 'domcontentloaded' });

      const container = page.locator(CONTENT).first();
      await expect(container).toBeAttached();

      // The viewport can be narrower than `w` once a scrollbar is taken out, so assert the
      // padding itself — that is the value the Figma grid specifies.
      const padding = await container.evaluate((el) => parseFloat(getComputedStyle(el).paddingLeft));
      expect(padding).toBe(margin);
    });
  }

  test('@2560px the content stays capped at 1848 and stays centered', async ({ page }) => {
    await page.setViewportSize({ width: 2560, height: 900 });
    await page.goto('/de/browse', { waitUntil: 'domcontentloaded' });

    await expect(page.locator(CONTENT).first()).toBeAttached();

    const width = await contentBoxWidth(page, CONTENT);
    expect(width).toBe(MAX_CONTENT);

    // centered: equal gap left and right
    const left = await contentBoxLeft(page, CONTENT);
    const viewport = await page.evaluate(() => document.documentElement.clientWidth);
    expect(left).toBe(Math.round((viewport - MAX_CONTENT) / 2));
  });
});

/**
 * The regression SHOW-320 was actually about: the header switched to 36px at md (1024) while
 * the page content switched at lg (1280), so both were offset by 20px across 1024–1279.
 * In Figma both sit on x=36 in the md frames — grid `420:10335` and PLP `12185:48039`.
 */
test.describe('Figma grid — header and content share one left edge', () => {
  for (const w of [768, 1024, 1100, 1279, 1280, 1920]) {
    test(`@${w}px header and page content start at the same x`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/de/browse', { waitUntil: 'domcontentloaded' });

      await expect(page.locator(CONTENT).first()).toBeAttached();

      const headerLeft = await contentBoxLeft(page, HEADER);
      const contentLeft = await contentBoxLeft(page, CONTENT);

      expect(headerLeft, `header container ${HEADER} not found`).not.toBeNull();
      expect(contentLeft, `content container ${CONTENT} not found`).not.toBeNull();
      expect(contentLeft).toBe(headerLeft);
    });
  }
});

/**
 * Templates that carry the container as `mx-4 md:mx-9` instead of the `content-container`
 * utility must land on the same edge. This is what catches a page being left behind when the
 * grid contract changes.
 */
test.describe('Figma grid — per-template left edge', () => {
  // `/de/register` is deliberately absent: the Figma "Login & Register" page (635:21894)
  // centers the form instead of aligning it to the grid — `Desktop max_registration`
  // (1459:71360) puts a 912px card at x=504 in a 1920 frame, `Desktop min_registration`
  // (2440:47084) a 790px card at x=117 in a 1024 frame. It is covered separately below.
  const ROUTES = ['/de/cart', '/de/quick-order'] as const;

  for (const route of ROUTES) {
    for (const { w, margin } of [
      { w: 1023, margin: 16 },
      { w: 1100, margin: 36 },
    ]) {
      test(`${route} @${w}px starts at ${margin}px`, async ({ page }) => {
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(route, { waitUntil: 'domcontentloaded' });

        // both classes, so this only matches the page container — not any `mx-4` further in
        const inner = page.locator('main [class~="mx-4"][class~="md:mx-9"]').first();
        await expect(inner).toBeAttached();

        const left = await inner.evaluate((el) => Math.round(el.getBoundingClientRect().left));
        expect(left).toBe(margin);
      });
    }
  }
});

/**
 * Login / registration is centered rather than grid-aligned — Figma page "Login & Register"
 * (635:21894). The card caps at 912px: `Desktop max_registration` (1459:71360) places a
 * 912px card at x=504 in a 1920 frame, i.e. (1920 − 912) / 2.
 */
test.describe('Figma — registration card is centered and capped', () => {
  const CARD_MAX = 912;

  for (const w of [1024, 1920]) {
    test(`@${w}px the registration card is centered`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto('/de/register', { waitUntil: 'domcontentloaded' });
      // Client island shows a spinner first; the capped card mounts after session load.
      await expect(page.getByTestId('register-submitButton')).toBeVisible({ timeout: 15_000 });

      // Token is `lg:max-w-228` (912px). `[class~="max-w-228"]` does not match that class.
      const card = page.locator('main [class~="lg:max-w-228"]').first();
      await expect(card).toBeAttached();

      const box = await card.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return { left: Math.round(r.left), width: Math.round(r.width) };
      });
      const viewport = await page.evaluate(() => document.documentElement.clientWidth);

      expect(box.width).toBeLessThanOrEqual(CARD_MAX);
      // centered: left gap equals right gap (±1 for sub-pixel rounding)
      const rightGap = viewport - box.left - box.width;
      expect(Math.abs(box.left - rightGap)).toBeLessThanOrEqual(1);
    });
  }
});
