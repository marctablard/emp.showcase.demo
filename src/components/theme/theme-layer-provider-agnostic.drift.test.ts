/**
 * Drift guard — the per-site theme layer stays provider-agnostic (ADR-0001).
 *
 * Per-site theming is a presentation leaf: it resolves a site code to a
 * static CSS href and emits a `<link>`. It must NOT reach into any data
 * source — no provider integration layer (`@/platform/integrations/*`), no
 * DI container (`inversify` / `@/platform/core/di`), no provider context
 * (`@/providers/*`), and no provider SDK (`@storyblok/*`). Coupling the
 * theme layer to a data source would make a CSS skin depend on runtime
 * provider wiring, breaking the "theming is a static leaf" contract.
 *
 * Source-text audit (not behavioural): reads each theme-layer file and
 * asserts on its import surface. Comments are stripped first so prose that
 * names a provider cannot trip a false positive.
 */
import fs from 'node:fs';
import path from 'node:path';

const stripComments = (source: string): string =>
  source.replaceAll(/\/\*[\s\S]*?\*\//g, '').replaceAll(/\/\/[^\n]*/g, '');

const readCode = (relativePath: string): string => {
  const raw = fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8') as string;
  return stripComments(raw);
};

const THEME_LAYER_FILES: Array<{ label: string; rel: string }> = [
  { label: 'site-theme-style.tsx', rel: './site-theme-style.tsx' },
  { label: 'app/styles/themes/index.ts', rel: '../../app/styles/themes/index.ts' },
];

describe('per-site theme layer — provider-agnostic drift guard', () => {
  for (const { label, rel } of THEME_LAYER_FILES) {
    describe(label, () => {
      const code = readCode(rel);

      it('does NOT import from any provider integration layer (@/platform/integrations/*)', () => {
        expect(code).not.toMatch(/@\/platform\/integrations\//);
        expect(code).not.toMatch(/@platform\/integrations\//);
      });

      it('does NOT import a DI container (inversify / @/platform/core/di)', () => {
        expect(code).not.toMatch(/from\s+['"]inversify['"]/);
        expect(code).not.toMatch(/@\/platform\/core\/di/);
      });

      it('does NOT import a provider context layer (@/providers/*)', () => {
        expect(code).not.toMatch(/@\/providers\//);
      });

      it('does NOT import a provider SDK (@storyblok/*)', () => {
        expect(code).not.toMatch(/@storyblok\//);
      });
    });
  }
});
