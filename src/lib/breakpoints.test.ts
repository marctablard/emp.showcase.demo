/**
 * Breakpoint consistency guard (SHOW-320).
 *
 * Breakpoints unavoidably live in two places: CSS (`globals.css`, in `rem`, used at
 * build time for the Tailwind `sm`/`md`/`lg` variants) and TS (`src/lib/breakpoints.ts`,
 * in `px`, used for runtime viewport logic). Tailwind v4 does NOT expose `--breakpoint-*`
 * as a runtime custom property, so JS cannot read the CSS values — the two sources must
 * be kept in lock-step. These tests are that lock-step guard, plus fitness checks that no
 * module re-introduces an ad-hoc/hardcoded breakpoint instead of importing the single
 * source of truth, and that no effect-less `xl:` variant survives (xl is not defined).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { breakpoints } from './breakpoints';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');

function parseCssBreakpoints(css: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of css.matchAll(/--breakpoint-([a-z0-9]+):\s*([\d.]+)rem/gi)) {
    out[m[1]] = parseFloat(m[2]) * 16; // rem → px at the 16px root font-size
  }
  return out;
}

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

const cssBreakpoints = parseCssBreakpoints(read('src/app/globals.css'));
const sourceFiles = walkSources('src');

describe('breakpoints — single source of truth', () => {
  it('exposes the canonical px values', () => {
    expect(breakpoints).toEqual({ sm: 768, md: 1024, lg: 1280 });
  });

  it('every CSS --breakpoint-* (rem) equals the TS value (px)', () => {
    for (const [name, px] of Object.entries(breakpoints)) {
      expect(`${name}=${cssBreakpoints[name]}`).toBe(`${name}=${px}`);
    }
  });

  it('CSS and TS declare exactly the same breakpoint keys (no xl/2xl drift)', () => {
    expect(Object.keys(cssBreakpoints).sort()).toEqual(Object.keys(breakpoints).sort());
  });
});

describe('breakpoints — no ad-hoc duplication outside the SSOT', () => {
  it('no module compares window.innerWidth against a numeric literal', () => {
    const offenders = sourceFiles.filter((f) => /window\.innerWidth\s*[<>=!]+\s*\d/.test(read(f)));
    expect(offenders).toEqual([]);
  });

  it('wishlist anchor references the breakpoints constant, not a hardcoded width', () => {
    const wishlist = read('src/components/wishlist/wishlist-added-notification.tsx');
    expect(wishlist).toMatch(/breakpoints\.(sm|md|lg)/);
    expect(wishlist).not.toMatch(/=\s*1024\b/);
  });

  it('dashboard grid references the breakpoints constant, not literals', () => {
    const dashboard = read('src/components/account/dashboard/dashboard.tsx');
    expect(dashboard).toMatch(/breakpoints/);
    expect(dashboard).not.toMatch(/breakpoints=\{\{\s*lg:\s*1280/);
  });

  it('no xl:/2xl: responsive variants and no xl- typos survive (xl is not a defined breakpoint)', () => {
    // `@xl:` (container query, 36rem container scale) is a different, valid mechanism and
    // deliberately excluded — only viewport variants `xl:`/`2xl:` are effect-less here.
    const offenders = sourceFiles.filter((f) => {
      const src = read(f);
      return /(?<![@\w])2?xl:(?=[a-z[])/.test(src) || /\bxl-col-/.test(src);
    });
    expect(offenders).toEqual([]);
  });
});
