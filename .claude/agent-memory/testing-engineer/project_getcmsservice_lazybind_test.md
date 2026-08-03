---
name: getcmsservice-lazybind-test
description: SHOW-323 Phase-C getCmsService lazy-bind helper test + CmsPage boundary switch; Slice-4 no-composite contract
metadata:
  type: project
---

Phase-C correction-loop fix for the production-build 500 (`No bindings found for "CmsAdapter"`): all CMS pages 500 under `next start` because `cms-page.tsx` did `ssr.get('CMSService')` directly and the `CmsAdapter` alias (bound only in `instrumentation.ts::register()`) lived on a different container instance than the RSC render-graph one (module-graph split). Fix = a `getCmsService()` helper that lazily binds the alias on the *active* container instance.

**Test files (this branch, committed 23f61937):**
- `src/platform/services/cms/get-cms-service.test.ts` — Platform Tests project (node, ts-jest). Mocks `@/platform/ssr` (default = fake container with isBound/bind/get jest.fns) and `./CmsProviderResolver` (only `resolveCmsProvider`). 4 branches: already-bound idempotent (no rebind), env-target available, target missing -> `CmsAdapter:none`, provider `none`.
- `src/components/cms/_core/cms-page.test.tsx` — React Tests project (jsdom, swc). Boundary mock switched from `ssr.get` to `jest.mock('@/platform/services/cms/get-cms-service')` returning `{ getPage }`. Assertion `getCmsServiceMock toHaveBeenCalledTimes(1)`.

**Why:** Slice-4 contract is the helper WITHOUT composite/default-content fallback (no `resolveCmsFallbackProvider`, no `FallbackCmsAdapter`, no `toConstantValue`). The source-repo (`showcase-bare imported/SHOW-323`) test is phases ahead and includes composite blocks — DROP those for Slice-4.

**How to apply:** This repo's valid `CmsProviderId`s are `['storyblok','local','none']` — NOT `'mock'`. The source-repo test uses `'mock'`; rewrite branches with `storyblok`/`none`. `resolveCmsFallbackProvider` does not exist in this repo's `CmsProviderResolver.ts` — do not mock it.
