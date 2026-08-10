/**
 * Drift guard — the central CMS renderer stays provider-agnostic.
 *
 * Pins the load-bearing acceptance criterion:
 *
 *   "Integrating a new CMS provider requires ONLY a new adapter; the central
 *    renderer (and the page shell that drives it) stays untouched."
 *
 * The architecture honours this by keeping all provider knowledge behind the
 * `CmsAdapter` SPI: adapters map provider payloads into the agnostic `CMSPage`
 * model, and `_core/` consumes that model through the map-driven `CmsRenderer`.
 * Neither `_core` file may reach into a provider integration layer
 * (`@/platform/integrations/*`) or import a provider SDK (`@storyblok/*`)
 * directly — doing so would couple the render path to one CMS and break the
 * "new adapter only" contract. See ADR 0001 for the adapter-owned render-path
 * rationale.
 *
 * This is a source-text audit (not a behavioural test): it reads each file and
 * asserts on its import surface. Comments are stripped before matching so that
 * documentation prose which *names* providers (e.g. the page-shell JSDoc that
 * enumerates "local-JSON, Storyblok, or none") does not trip a false positive.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * Strip line (`//`) and block comments so prose that mentions a provider name
 * inside a doc-comment cannot be mistaken for executable import surface.
 */
const stripComments = (source: string): string =>
  source
    .replaceAll(/\/\*[\s\S]*?\*\//g, '') // block comments, incl. JSDoc
    .replaceAll(/\/\/[^\n]*/g, ''); // line comments

const readCode = (relativePath: string): string => {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8') as string;
  return stripComments(raw);
};

describe('central CMS renderer — provider-agnostic drift guard', () => {
  describe('cms-renderer.tsx', () => {
    const code = readCode('./cms-renderer.tsx');

    it('does NOT import from any provider integration layer (@/platform/integrations/*)', () => {
      expect(code).not.toMatch(/@\/platform\/integrations\//);
      expect(code).not.toMatch(/@platform\/integrations\//);
    });

    it('does NOT import a Storyblok SDK package (@storyblok/*) directly', () => {
      expect(code).not.toMatch(/@storyblok\//);
    });

    it('dispatches generically via the component map — no hardcoded provider discriminator switch', () => {
      // The renderer resolves components by looking up `cmsComponentMap[type]`.
      // It must not branch on a provider name; pin against the obvious leaks.
      expect(code).toMatch(/cmsComponentMap/);
      expect(code).not.toMatch(/\bstoryblok\b/i);
    });
  });

  describe('cms-page.tsx', () => {
    const code = readCode('./cms-page.tsx');

    it('does NOT import from any provider integration layer (@/platform/integrations/*)', () => {
      expect(code).not.toMatch(/@\/platform\/integrations\//);
      expect(code).not.toMatch(/@platform\/integrations\//);
    });

    it('does NOT import a Storyblok SDK package (@storyblok/*) directly', () => {
      expect(code).not.toMatch(/@storyblok\//);
    });

    it('reaches the CMS only through the provider-agnostic service facade', () => {
      // The shell fetches via the `CMSService` facade, which the DI container
      // binds to the active adapter. No provider name appears in executable code.
      expect(code).toMatch(/get-cms-service/);
      expect(code).not.toMatch(/\bstoryblok\b/i);
    });
  });
});
