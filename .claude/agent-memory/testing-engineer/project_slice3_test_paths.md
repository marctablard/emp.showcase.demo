---
name: slice3-test-paths
description: Slice 3 walking-skeleton CMS-component-foundation completion — 14 remaining default-component failing tests + drift-guard inventory extension
metadata:
  type: project
---

Slice-3-Pre-Implementation-Tests committed on `feature/SHOW-323` (commit `a7aa227e`). Real-failing mode (per [[pre-implementation-real-failing]]) — architect brief said "alle 14 ... rot". 14 remaining default components co-located + full registry inventory pin.

**Test paths committed (each `src/components/cms/<name>/<name>.test.tsx`):**
logo, video, teaser, quick-entry, feature, category, segment, recommendations, column-teaser, top-banner-announcement, media-text, columns, grid, navigation.

**Plus:** `src/components/cms/component-map.test.ts` inventory pin extended from 6 (article, button, content-block, hero, page, richtext) to all **20** (sorted). Drift-guard goes red until frontend-developer registers all 14 — gewollt.

**Jest project routing:** all land in **"React Tests"** (jsdom).

**Failure proof at commit:** 102 suites, 15 failed (14 components `Cannot find module './index'` + drift-guard 1 failed assertion). 848 passed / 849 total (the 1 failing test = the inventory pin). Baseline (Slice-1+2) otherwise green.

**article is NOT in Slice 3** — it was migrated during the Slice-2 correction loop (already in the 6-component baseline pin). The slice-3 spec §3 still lists it (15) but the count is 14.

**Source-repo as spec-by-example:** all 14 had fully-developed `<name>.test.tsx` + `schema.ts` in `imported/SHOW-323` (showcase-bare). I reused the assertion contracts but REWROTE the JSDoc prose to strip task-internals (see [[prose-clean-source-repo-tests]]).

**Structural divergence showcase vs source:** source recursive containers (segment/columns/grid) import `../_core/component-schema`; showcase uses flat `./component-schema` and the page-pattern (schema owned in `component-schema.ts`, re-exported from `<name>/schema.ts`). My tests import only from `./index` and pin behaviour, so they're agnostic to which module owns the recursive schema — the developer picks the showcase-flat layout.

**Notable per-component contract pins:**
- `recommendations`: mocks `./recommendations-carousel` (client island the dev must build); pins no-data / empty-`products` path → `firstChild === null`.
- `top-banner-announcement`: pins the spread-gap fix — `...rest` must land on the rendered `<a>` root (see [[top-banner-spread-gap]]); `is_active=false` → empty DOM.
- `media-text`: schema pulls `TextEditorDataSchema` from new `_shared/text-editor.schema.ts` (does not exist yet).
- `columns`: pins `flex-1` per-child cell wrapping; both containers pin z.lazy recursion + transitive reject.
- `navigation`: render-component (NOT the `CMSNavigation` domain type); pins `<nav>` root, `<li>` per item, no React duplicate-key console.error, agnostic `id` (not `_uid`).

Related: [[slice2-test-paths]], [[pre-implementation-real-failing]], [[prose-clean-source-repo-tests]], [[top-banner-spread-gap]]
