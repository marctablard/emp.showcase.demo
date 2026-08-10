/**
 * Drift guard — the site middleware stays out of the Storyblok integration
 * (EMP-15 §7). The middleware runs on the Edge runtime; it may flag preview
 * requests only through the *pure, edge-safe* detector registry
 * (`@/platform/services/cms/preview/preview-detector-registry`). It must NEVER
 * import the Storyblok SDK (`@storyblok/*`) nor the Storyblok integration
 * layer (`@/platform/integrations/storyblok/**`), since either would pull SDK
 * code into the Edge bundle (`.next/server/middleware.js`).
 *
 * Source-text audit (not behavioural): reads `src/site/middleware.ts` and
 * asserts on its import surface. Comments are stripped first so prose naming a
 * provider cannot trip a false positive.
 */
import fs from 'node:fs';
import path from 'node:path';

const stripComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');

const MIDDLEWARE_PATH = path.resolve(__dirname, '../../site/middleware.ts');

describe('site middleware — no direct Storyblok import drift guard', () => {
  it('has the middleware file to audit', () => {
    expect(fs.existsSync(MIDDLEWARE_PATH)).toBe(true);
  });

  const code = stripComments(fs.readFileSync(MIDDLEWARE_PATH, 'utf8') as string);

  it('does NOT import the Storyblok SDK (@storyblok/*)', () => {
    expect(code).not.toMatch(/@storyblok\//);
  });

  it('does NOT import the Storyblok integration layer (@/platform/integrations/storyblok/**)', () => {
    expect(code).not.toMatch(/@\/platform\/integrations\/storyblok\//);
    expect(code).not.toMatch(/@platform\/integrations\/storyblok\//);
  });

  it('wires preview detection through the edge-safe detector registry', () => {
    expect(code).toMatch(/preview-detector-registry/);
    expect(code).toMatch(/getPreviewDetector/);
    expect(code).toMatch(/PREVIEW_ROUTE_PREFIX/);
  });
});
