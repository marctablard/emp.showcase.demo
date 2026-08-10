---
name: phasef-preview-test-paths
description: EMP-15 Phase F preview-route (SPI-split) pre-impl test paths + jest-project routing + RED reasons.
metadata:
  type: project
---

EMP-15 Phase F = provider-agnostic Preview-Route, SPI-split (edge-safe CmsPreviewDetector vs node-only CmsPreviewAdapter). Pre-impl FAILING tests written on feature/SHOW-323.

**Test files (all RED at write time):**
- `src/lib/__tests__/app-preview-no-storyblok-import.drift.test.ts` — Library Tests. Walks `src/app/preview/**`, asserts no `@storyblok/*` import; needs `getPreviewAdapter`. RED: no source files yet (`length>0` fails).
- `src/lib/__tests__/middleware-no-direct-storyblok-import.drift.test.ts` — Library Tests. Reads `src/site/middleware.ts`. The 3 import-surface asserts PASS today (middleware clean); only the "wires preview detection" (preview-detector-registry / getPreviewDetector / PREVIEW_ROUTE_PREFIX) asserts are RED until §7 wiring lands.
- `src/platform/integrations/storyblok/cms/preview/storyblok-preview-detection.test.ts` — Platform Tests. RED: Cannot find module (pure detector).
- `src/platform/services/cms/preview/preview-detector-registry.test.ts` — Platform Tests (under src/platform/**). RED: Cannot find module.
- `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.getSpaceId.test.ts` — Platform Tests. RED: `api.getSpaceId is not a function` (impl loads, method absent).
- `src/platform/integrations/storyblok/cms/preview/StoryblokPreviewAdapter.test.ts` — Platform Tests. RED: Cannot find module `./StoryblokPreviewAdapter`.

**Why:** mandated cross-review chain — testing-engineer writes failing acceptance+drift tests before any impl.

**How to apply:**
- From `.../cms/preview/`, relative paths to siblings are `../StoryblokCmsApi`, `../impl/StoryblokBridgeScript` (NOT `../../`; preview is one level under cms). Got this wrong first pass — mock path failed to resolve, masking the real subject-missing RED.
- StoryblokPreviewAdapter.test mocks `../impl/StoryblokBridgeScript` (client comp imports `@storyblok/*` at module load) so the Node test stays SDK-free. Mirror StoryblokCmsApi.test.ts SDK mock for getSpaceId.
- Clock-dependent timestamp window (now-3600..now+60): use `jest.useFakeTimers()` + `jest.setSystemTime`, never wall clock.
- Provider union is `['storyblok','local','none']` (resolveCmsProvider), NOT 'mock'. `mock` value auto-resolves to 'none'. Registry never-detector id is 'none'.
