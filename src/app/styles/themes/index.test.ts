/**
 * Acceptance contract for the per-site theme registry.
 *
 * `resolveThemeForSite` maps a site code to its stylesheet href, falling
 * back to the (empty) default theme for any site without an explicit file.
 * The fallback is what guarantees an un-themed site inherits NO other site's
 * overrides.
 */
import { DEFAULT_THEME_HREF, THEME_MAP, resolveThemeForSite } from './index';

describe('resolveThemeForSite', () => {
  it('resolves a known site code to its theme file', () => {
    expect(resolveThemeForSite('main')).toBe('/themes/main.css');
    expect(resolveThemeForSite('us-branch')).toBe('/themes/us-branch.css');
    expect(resolveThemeForSite('showcase')).toBe('/themes/showcase.css');
  });

  it('falls back to the default theme for an unknown site code', () => {
    expect(resolveThemeForSite('does-not-exist')).toBe(DEFAULT_THEME_HREF);
  });

  it('falls back to the default theme for a null / undefined / empty site code', () => {
    expect(resolveThemeForSite(null)).toBe(DEFAULT_THEME_HREF);
    expect(resolveThemeForSite(undefined)).toBe(DEFAULT_THEME_HREF);
    expect(resolveThemeForSite('')).toBe(DEFAULT_THEME_HREF);
  });

  it('resolves every mapped site to a distinct href (no accidental aliasing)', () => {
    const hrefs = Object.keys(THEME_MAP).map((code) => resolveThemeForSite(code));
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('points the default href at the deliberately empty default theme', () => {
    expect(DEFAULT_THEME_HREF).toBe('/themes/_default_.css');
  });
});

describe('public/themes/_default_.css — no-cascade invariant', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
  const fs = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
  const path = require('node:path');

  // src/app/styles/themes -> repo root is four levels up.
  const defaultCss = fs.readFileSync(
    path.resolve(__dirname, '../../../../public/themes/_default_.css'),
    'utf8',
  ) as string;

  // Strip block comments so the explanatory header does not trip the guards.
  const code = defaultCss.replace(/\/\*[\s\S]*?\*\//g, '').trim();

  it('declares no `:root` block (so it cannot cascade onto other sites)', () => {
    expect(code).not.toMatch(/:root/);
  });

  it('declares no design-token / color custom properties', () => {
    expect(code).not.toMatch(/--color-/);
    expect(code).not.toMatch(/--[\w-]+\s*:/);
  });

  it('is effectively empty once comments are stripped', () => {
    expect(code).toBe('');
  });
});
