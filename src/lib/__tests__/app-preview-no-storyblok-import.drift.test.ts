/**
 * Drift guard — the preview app route stays provider-agnostic (EMP-15 §6).
 *
 * `src/app/preview/[site]/[locale]/[[...slug]]/page.tsx` dispatches ONLY
 * through the adapter registry (`getPreviewAdapter()`); it must never reach
 * into the Storyblok SDK directly. A direct `@storyblok/*` import in any
 * (non-test) source file under `src/app/preview/**` would couple the route to
 * one provider and bypass the preview-adapter SPI — this test turns red if
 * that happens.
 *
 * Source-text audit (not behavioural): walks every non-test file under
 * `src/app/preview/**` and asserts on its import surface. Comments are
 * stripped first so prose naming a provider cannot trip a false positive.
 */

// `export {}` makes this file a module so its top-level `const`s are
// file-scoped (other `*.drift.test.ts` files declare the same names).
export {};

// eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
const fs = require('node:fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- test-time source-text inspection
const path = require('node:path');

const stripComments = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

const PREVIEW_ROOT = path.resolve(__dirname, '../../app/preview');

/** Recursively collect every non-test `.ts`/`.tsx` file under `dir`. */
function collectSourceFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    return [];
  }
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }) as Array<{
    name: string;
    isDirectory: () => boolean;
  }>) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

const sourceFiles = collectSourceFiles(PREVIEW_ROOT);

describe('preview app route — provider-agnostic drift guard', () => {
  it('has at least one source file to audit (page.tsx)', () => {
    // Red until the route lands; protects the audit from passing vacuously.
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(sourceFiles.some((f) => /page\.tsx$/.test(f))).toBe(true);
  });

  for (const file of sourceFiles) {
    const rel = path.relative(PREVIEW_ROOT, file);
    describe(rel, () => {
      const code = stripComments(fs.readFileSync(file, 'utf8') as string);

      it('does NOT import the Storyblok SDK (@storyblok/*)', () => {
        expect(code).not.toMatch(/@storyblok\//);
      });

      it('does NOT import the Storyblok integration layer (@/platform/integrations/storyblok/*)', () => {
        expect(code).not.toMatch(/@\/platform\/integrations\/storyblok\//);
        expect(code).not.toMatch(/@platform\/integrations\/storyblok\//);
      });

      it('dispatches through the preview-adapter registry helper getPreviewAdapter()', () => {
        expect(code).toMatch(/getPreviewAdapter/);
      });
    });
  }
});
