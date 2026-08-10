/**
 * content-container @utility (SHOW-320).
 *
 * The shared layout container must compile to the Figma grid contract:
 *   max-width 1920px (the 6xl token) + auto side margins + 16px side padding below md
 *   and 36px from md (1024px) up — which yields 952px of content at 1024 and 1848px at a
 *   1920px viewport (1920 − 2×36), exactly the Figma "Maximum 1848px total width" spec,
 *   and full-bleed centering beyond 1920.
 *
 * Part 1 compiles the REAL globals.css with Tailwind so the assertions cover the actually
 * generated CSS. Part 2 is a fitness check that the verbatim container duplicate
 * (`max-w-6xl mx-auto px-4 lg:px-9`) and the off-spec `max-w-[1848px]` container no longer
 * appear inline — they must use the `content-container` utility instead.
 */
import tailwind from '@tailwindcss/postcss';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';

const ROOT = path.resolve(__dirname, '../..');
const globalsCssPath = path.join(ROOT, 'src/app/globals.css');
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');

function walkSources(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(path.join(ROOT, dir))) {
    const rel = path.join(dir, entry);
    if (statSync(path.join(ROOT, rel)).isDirectory()) {
      walkSources(rel, acc);
    } else if (/\.tsx?$/.test(rel) && !rel.includes('.test.') && !rel.includes('.spec.')) {
      acc.push(rel);
    }
  }
  return acc;
}
const sourceFiles = walkSources('src');

/** Extract a full top-level rule (balancing braces, so nested @media stays included). */
function extractRule(css: string, selector: string): string {
  const spaced = css.indexOf(selector + ' {');
  const start = spaced === -1 ? css.indexOf(selector + '{') : spaced;
  if (start === -1) return '';
  let depth = 0;
  for (let i = css.indexOf('{', start); i < css.length; i++) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}' && --depth === 0) return css.slice(start, i + 1);
  }
  return '';
}

describe('content-container @utility', () => {
  let rule: string;

  beforeAll(async () => {
    const src = readFileSync(globalsCssPath, 'utf8') + '\n@source inline("content-container");\n';
    const out = await postcss([tailwind()]).process(src, { from: globalsCssPath });
    rule = extractRule(out.css, '.content-container');
  }, 60000);

  it('is generated as a .content-container rule', () => {
    expect(rule).not.toBe('');
  });

  it('caps the width at the 6xl container token (1920px)', () => {
    expect(rule).toMatch(/max-width:\s*(var\(--theme-container-6xl\)|120rem)/);
  });

  it('centers via auto inline margins', () => {
    expect(rule).toMatch(/margin-inline:\s*auto/);
  });

  it('has 16px side padding below lg (matches px-4)', () => {
    expect(rule).toMatch(/padding-inline:\s*(calc\(var\(--spacing\)\s*\*\s*4\)|1rem)/);
  });

  it('grows to 36px side padding from md (1024px) up — content = 952 at 1024, 1848 at 1920 (matches md:px-9)', () => {
    // md = 64rem = 1024px. Figma grid frame `md | Desktop min-width-1024` (420:10335) has its
    // columns at x=36, and the PLP md frame (12185:48039) puts header AND content on x=36 —
    // so the container must switch where the header (`md:px-9`) switches, not at lg.
    expect(rule).toMatch(/@media[^{]*\b64rem\b/);
    expect(rule).not.toMatch(/@media[^{]*\b80rem\b/);
    expect(rule).toMatch(/padding-inline:\s*(calc\(var\(--spacing\)\s*\*\s*9\)|2\.25rem)/);
  });
});

describe('content-container — inline duplicates are migrated', () => {
  // A base `px-4` class (preceded by whitespace/quote), NOT `sm:px-4`/`md:px-4`.
  const hasBasePx4 = (line: string) => /(^|[\s"'`])px-4(?=[\s"'`])/.test(line);

  it('no className inlines the full container pattern (max-w-6xl + px-4 + md/lg:px-9)', () => {
    const offenders = sourceFiles.filter((f) =>
      read(f)
        .split('\n')
        .some(
          (line) =>
            line.includes('max-w-6xl') && hasBasePx4(line) && (line.includes('md:px-9') || line.includes('lg:px-9')),
        ),
    );
    expect(offenders).toEqual([]);
  });

  it('no container still uses the pre-SHOW-320 lg step (36px starts at md/1024)', () => {
    const offenders = sourceFiles.filter((f) => /\blg:[mp]x-9\b/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('no off-spec max-w-[1848px] container survives (must use content-container)', () => {
    const offenders = sourceFiles.filter((f) => read(f).includes('max-w-[1848px]'));
    expect(offenders).toEqual([]);
  });
});
