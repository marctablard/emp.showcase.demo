---
name: slice2-test-paths
description: Slice 2 walking-skeleton CMS-component-foundation test paths in showcase + project routing
metadata:
  type: project
---

Slice-2-Pre-Implementation-Tests committed on `feature/SHOW-323` (commit `a560104c`). Walking-skeleton variant: 5 pilot components (button, hero, content-block, richtext, page) + foundation drift-guard.

**Test paths committed:**
- `src/components/cms/button/button.test.tsx`
- `src/components/cms/hero/hero.test.tsx`
- `src/components/cms/content-block/content-block.test.tsx`
- `src/components/cms/richtext/richtext.test.tsx`
- `src/components/cms/page/page.test.tsx`
- `src/components/cms/component-map.test.ts`

**Jest project routing:** all six land in **"React Tests"** (jsdom) via the `**/components/cms/**/?(*.)+(spec|test).ts?(x)` testMatch. No platform-side counterparts needed for slice 2.

**Why:** so the cross-reviewer (architect) can find each pilot's test in one place and the engineer building each pilot has a single failing surface to drive RED-GREEN against — no test-file scattering.

**How to apply:**
- Slice-3 follow-up adds the remaining 15 pilots (article, category, column-teaser, columns, feature, grid, logo, media-text, navigation, quick-entry, recommendations, segment, teaser, top-banner-announcement, video). Each lands at the same path pattern.
- The 5-pilot inventory pin in `component-map.test.ts` (`['button', 'content-block', 'hero', 'page', 'richtext']`) MUST be extended in slice 3 — this is a legitimate contract tightening per [[env-pin-list-extension]]; never loosen it as part of an unrelated commit.

**Baseline at commit:** 758 passed tests, 79 passed suites. Slice-2 commit adds 6 failed suites (red on `Cannot find module './index'` / `./component-map` / `./component-schema`), 0 test-count change. The suites compile only once the engineer creates the barrel files.

**Architect modus for slice 2:** real failing tests (not `describe.skip` stubs) — see [[pre-implementation-real-failing]]. The architect's task brief explicitly said "alle Tests **rot**", confirming this slice's per-slice override of the [[pre-implementation-stubs]] default.

**Richtext block-AST coverage (plan §8):** the pilot test pins `heading | paragraph | list | image | quote | code` block kinds and `text (bold/italic/code) | link` inline kinds via observable DOM (`<h1>`..`<h6>`, `<p>`, `<ol>`/`<ul>`, `<img>`, `<blockquote>`, `<pre><code>`, `<strong>`/`<b>`, `<em>`/`<i>`, `<a>`). DOM-pinning is intentional per [[richtext-schema-vs-renderer-split]] — survives renderer/schema/mapper revisions.

**Dead-code-cleanup drift-pin omitted intentionally:** the architect's brief noted file-existence tests are brittle; cleanup of `LocalCMSServiceSSR.ts` + `src/components/cms/local/local-cms-page.tsx` will be verified during cross-review, not via a brittle `existsSync()` test.

Related: [[showcase-vs-frontend-test-env]], [[slice1-test-paths]], [[richtext-schema-vs-renderer-split]], [[pre-implementation-real-failing]]
