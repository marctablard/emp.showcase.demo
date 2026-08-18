/**
 * Figma alignment regression locks (SHOW-320 review round).
 *
 * Every assertion here encodes a Figma-verified SOLL value from the design review
 * (7 extraction agents + 14 adversarial verifications, all confirmed; measured values
 * persisted in memory/design_figma-component-soll-werte.md). These are deliberate
 * source-level locks: they pin the exact utility classes that were wrong before, so a
 * refactor cannot silently reintroduce a confirmed deviation. If a lock fails, check the
 * design spec before changing the test — the numbers come from measured Figma frames,
 * not from taste.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../..');
const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8');

// These locks read components by PATH, so a file move breaks them with ENOENT rather
// than a failed assertion. SHOW-323 moved the CMS components into per-component folders
// (`cms/hero.tsx` → `cms/hero/hero.tsx`, and likewise for column-teaser and media-text);
// the paths below follow that layout. If a component moves again, update the path here —
// the measured Figma values themselves are unaffected by where the file lives.

// Header AND content both switch to 36px at md (1024). An earlier review round recorded
// "content at 1280" here; re-measuring the Figma grid frame `md | Desktop min-width-1024`
// (420:10335, columns at x=36) and the PLP md frame (12185:48039, header and content both
// at x=36) showed that to be wrong — see the `content-container` @utility in globals.css.
describe('header — 36px side padding from md (Figma: header and content both switch at 1024)', () => {
  for (const rel of ['src/components/header/header.tsx', 'src/components/header/header-checkout.tsx']) {
    it(`${path.basename(rel)} uses md:px-9 and no lg:px-9 / md:pt-3`, () => {
      const src = read(rel);
      expect(src).toContain('md:px-9');
      expect(src).not.toContain('lg:px-9');
      expect(src).not.toContain('md:pt-3');
    });
  }
});

describe('create-return dialog — 736/790/1224 steps (Figma Order-History frames)', () => {
  it('uses sm:/md:/lg: prefixed max-widths and no unprefixed 736 (sm:max-w-lg base bug) or 1106', () => {
    const src = read('src/components/account/orders/create-return-dialog.tsx');
    expect(src).toContain('sm:max-w-[736px]');
    expect(src).toContain('md:max-w-[790px]');
    expect(src).toContain('lg:max-w-[1224px]');
    // below 768 the base `max-w-[calc(100%-2rem)]` from ui/dialog.tsx must be neutralised
    expect(src).toContain('max-w-none');
    // unprefixed max-w-[736px] loses against the dialog base `sm:max-w-lg` (512px) from 768px up
    expect(src).not.toMatch(/[^:]max-w-\[736px\]/);
    expect(src).not.toContain('1106');
  });
});

describe('PDP detail grids (Figma PDP page frames)', () => {
  const src = () => read('src/components/product/product-detail.tsx');

  it('technical information keeps 24px row gap while 2-col (64px only with the lg 4-col layout)', () => {
    expect(src()).toContain('lg:gap-y-16');
    expect(src()).not.toContain('md:gap-y-16');
  });

  it('key specs fill column-wise at lg with an explicit row count (implicit columns would overflow)', () => {
    expect(src()).toContain('lg:grid-flow-col');
    expect(src()).toContain('--key-spec-rows');
  });

  it('price block spans the full row on every breakpoint', () => {
    expect(src()).toContain('sm:col-end-3');
    expect(src()).toContain('md:col-end-4');
    expect(src()).toContain('lg:col-end-5');
  });
});

describe('hero (Figma startpage masters + behavior spec 813:35983)', () => {
  it('text box is a 50/50 split (no 4/7) and spacing below is 40/104/80', () => {
    const src = read('src/components/cms/hero/hero.tsx');
    expect(src).not.toContain('lg:w-4/7');
    expect(src).not.toContain('sm:mb-20 md:mb-10');
    expect(src).toContain('sm:mb-26 md:mb-20');
  });

  it('image container heights match the Figma masks (260/540/740)', () => {
    const src = read('src/components/cms/hero/hero.tsx');
    expect(src).toContain('h-65');
    expect(src).toContain('sm:h-135');
    expect(src).toContain('md:h-185');
    expect(src).not.toContain('h-100');
    expect(src).not.toContain('sm:h-145');
  });

  it('mobile text box sits in flow overlapping 24px downwards; sm+ overlays absolutely', () => {
    const src = read('src/components/cms/hero/hero.tsx');
    expect(src).toContain('-mt-6');
    expect(src).toContain('sm:absolute');
    expect(src).toContain('sm:-bottom-10');
    expect(src).toContain('md:bottom-20');
  });
});

describe('cart & checkout — fixed summary column 340@md/444@lg with 24px gutter', () => {
  for (const rel of [
    'src/components/cart/cart-overview.tsx',
    'src/components/cart/cart-action.tsx',
    'src/components/checkout/checkout.tsx',
  ]) {
    it(`${path.basename(rel)} uses the asymmetric two-column template`, () => {
      const src = read(rel);
      expect(src).toContain('md:grid-cols-[minmax(0,1fr)_340px]');
      expect(src).toContain('lg:grid-cols-[minmax(0,1fr)_444px]');
      expect(src).not.toContain('md:gap-8');
      expect(src).not.toContain('gap-8');
    });
  }

  for (const rel of ['src/components/cart/cart-summary.tsx', 'src/components/checkout/checkout-summary.tsx']) {
    it(`${path.basename(rel)} has no dead 438px cap and pins the fixed state to the column width`, () => {
      const src = read(rel);
      expect(src).not.toContain('md:max-w-[438px]');
      expect(src).toContain('md:w-[340px]');
      expect(src).toContain('lg:w-[444px]');
    });
  }
});

describe('account — sidebar persistent from 768 (Figma: only mobile uses the drawer)', () => {
  it('account-layout gates the sidebar at sm', () => {
    const src = read('src/components/account/account-layout.tsx');
    expect(src).toMatch(/useBreakpoint\('sm'\)/);
    expect(src).not.toMatch(/useBreakpoint\('lg'\)/);
  });

  it('account-layout phone drawer ends above the 58px bar with dvh', () => {
    const src = read('src/components/account/account-layout.tsx');
    expect(src).toContain('bottom-[58px]');
    expect(src).toContain('h-[calc(100dvh-58px)]');
    expect(src).toContain('overscroll-contain');
    expect(src).toContain('scrollable={false}');
    expect(src).not.toMatch(/h-\[[^\]]*100vh[^\]]*\]/);
  });

  it('account-layout margins/padding are declarative (16px@sm, 36px@md; no px-4/px-0 class conflict)', () => {
    const src = read('src/components/account/account-layout.tsx');
    expect(src).toContain('sm:mx-4');
    // 36px starts at md (1024) — same switch point as the header and the sidebar width below
    expect(src).toContain('md:mx-9');
    expect(src).not.toContain('lg:mx-9');
    expect(src).toContain('sm:px-0');
    // template-literal conditional padding produced conflicting px-4 + px-0 (px-4 wins in the stylesheet)
    expect(src).not.toMatch(/px-4 \$\{/);
  });

  it('sidebar widens to 288px from md (1024), not lg', () => {
    const src = read('src/components/account/account-sidebar.tsx');
    expect(src).toContain('md:min-w-[288px]');
    expect(src).not.toContain('lg:min-w-[288px]');
  });

  it('sidebar rail uses header-subtracted dvh max-h scrollport', () => {
    const src = read('src/components/account/account-sidebar.tsx');
    expect(src).toContain('overflow-y-auto');
    expect(src).toContain('min-h-0');
    expect(src).toContain('overscroll-contain');
    expect(src).toContain('max-h-[calc(100dvh-11rem)]');
    expect(src).toContain('md:max-h-[calc(100dvh-15rem)]');
    expect(src).not.toMatch(/max-h-\[100dvh\]/);
    expect(read('src/components/account/account-layout.tsx')).toContain('scrollable={false}');
  });

  it('quote summary cards switch 1→2 at the 576px container step (@xl), not 512 (@lg)', () => {
    const src = read('src/components/account/quotes/quote-summary.tsx');
    expect(src).toContain('@xl:grid-cols-2');
    // three cards since the details card was folded into the quote header, so the top step is 3-up
    expect(src).toContain('@5xl:grid-cols-3');
    expect(src).not.toContain('@lg:grid-cols-2');
  });
});

describe('cms organisms', () => {
  it('column teaser sits in the shared content container (was glued to the viewport edge)', () => {
    const src = read('src/components/cms/column-teaser/column-teaser.tsx');
    expect(src).toContain('content-container');
    expect(src).not.toContain('max-w-6xl');
  });

  it('media+text uses the 24px gutter from md (Figma grid gutter)', () => {
    expect(read('src/components/cms/media-text/media-text.tsx')).toContain('md:gap-6');
  });
});
