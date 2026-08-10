/**
 * Drift guard — the preview app route stays provider-agnostic.
 *
 * The preview page (`src/app/preview/[site]/[locale]/[[...slug]]/page.tsx`)
 * dispatches ONLY through the adapter registry (`getPreviewAdapter()`); it must
 * never reach into the Storyblok SDK directly. A direct `@storyblok/*` import
 * — or an import of the Storyblok integration layer — in any (non-test) source
 * file under `src/app/preview/**` would couple the route to one provider and
 * bypass the preview-adapter SPI; this test turns red if that happens.
 *
 * Sibling files (`layout.tsx`, helpers, ...) only enforce the no-provider-import
 * invariants. The `getPreviewAdapter()` dispatch contract applies to `page.tsx`
 * specifically, asserted once as a file-level guard so adding a wrapper layout
 * cannot trip the test.
 *
 * Source-text audit (not behavioural): walks every non-test file under
 * `src/app/preview/**` and asserts on its import surface. Comments are
 * stripped first so prose naming a provider cannot trip a false positive.
 */
import fs from 'node:fs';
import path from 'node:path';

const stripComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');

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
const pageFiles = sourceFiles.filter((f) => /(^|[\\/])page\.tsx$/.test(f));

describe('preview app route — provider-agnostic drift guard', () => {
  it('has at least one source file to audit (page.tsx)', () => {
    // Red until the route lands; protects the audit from passing vacuously.
    expect(sourceFiles.length).toBeGreaterThan(0);
    expect(pageFiles.length).toBeGreaterThan(0);
  });

  it('every preview page.tsx dispatches through getPreviewAdapter()', () => {
    // Asserted once for all `page.tsx` files so the no-provider-import asserts
    // below stay file-scoped while the dispatch contract stays guaranteed.
    expect(pageFiles.length).toBeGreaterThan(0);
    for (const file of pageFiles) {
      const code = stripComments(fs.readFileSync(file, 'utf8') as string);
      expect(code).toMatch(/getPreviewAdapter/);
    }
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
    });
  }
});
