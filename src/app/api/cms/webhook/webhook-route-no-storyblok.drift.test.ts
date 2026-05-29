/**
 * Drift guard — the CMS webhook endpoint stays provider-agnostic (EMP-14 §1.5).
 *
 * `POST /api/cms/webhook` must dispatch ONLY through DI (`getCmsService()`); it
 * must never reach into the Storyblok integration directly. A direct
 * `@storyblok/*` or `@/platform/integrations/storyblok/*` import in any
 * (non-test) source file under this directory would couple the route to one
 * provider and bypass the adapter SPI — this test turns red if that happens.
 *
 * Source-text audit (not behavioural): reads each non-test file in the webhook
 * directory and asserts on its import surface. Comments are stripped first so
 * prose naming a provider cannot trip a false positive.
 */

// `export {}` makes this file a module so its top-level `const`s are
// file-scoped (other `*.drift.test.ts` files declare the same names).
export {};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
const fs = require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
const path = require('node:path');

const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const sourceFiles = (fs.readdirSync(__dirname) as string[]).filter(
  (file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file),
);

describe('CMS webhook endpoint — provider-agnostic drift guard', () => {
  it('has at least one source file to audit (route.ts)', () => {
    expect(sourceFiles).toContain('route.ts');
  });

  for (const file of sourceFiles) {
    describe(file, () => {
      const code = stripComments(fs.readFileSync(path.join(__dirname, file), 'utf8') as string);

      it('does NOT import the Storyblok SDK (@storyblok/*)', () => {
        expect(code).not.toMatch(/@storyblok\//);
      });

      it('does NOT import the Storyblok integration layer (@/platform/integrations/storyblok/*)', () => {
        expect(code).not.toMatch(/@\/platform\/integrations\/storyblok\//);
        expect(code).not.toMatch(/@platform\/integrations\/storyblok\//);
      });

      it('dispatches through the DI helper getCmsService()', () => {
        expect(code).toMatch(/getCmsService/);
      });
    });
  }
});
