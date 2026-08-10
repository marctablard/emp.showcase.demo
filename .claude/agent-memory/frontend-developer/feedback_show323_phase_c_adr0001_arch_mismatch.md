---
name: show323-phase-c-adr0001-arch-mismatch
description: Phase-C doc port blocked — template ADR 0001 ("adapters own renderPage") describes an architecture showcase never implemented; showcase code is the central-renderer architecture the template says was superseded.
metadata:
  type: feedback
---

Phase C asked to port the imported/SHOW-323 CMS docs (ADR 0001 + cms-framework.md) adapted to showcase, expecting only naming adaptation (LocalJson/`local` vs "Mock"). The real divergence is architectural, not cosmetic.

**Template architecture (imported/SHOW-323 docs):** ADR 0001 = "CMS adapters own their render path". SPI has `renderPage(ctx): ReactNode`; the central `CmsRenderer` is the Local adapter's tool only; Storyblok renders via SDK `<StoryblokStory>` + `storyblok/cms/components/registry.ts` thin wrappers; `content-slot` slot-forwarding; webhook pipeline (`handleWebhook`/`mapWebhookPayload`/`WebhookEvent.tag`/HMAC); `FallbackCmsAdapter`. ADR 0001 explicitly says this SUPERSEDED "a single agnostic CmsRenderer + component-map renders every provider's content".

**Showcase code reality (verified 2026-05-27):** showcase IS that superseded central-renderer architecture.
- `CmsAdapter.d.ts` SPI: `id/hasContent/getPage/getNavigation` + optional `getEditableProps`/`BridgeScript`. **No `renderPage`, no `CmsRenderContext`.**
- `cms-page.tsx` walks `page.components` and renders `<CmsRenderer component>` directly for ALL providers.
- `cms-renderer.tsx` central map-driven renderer used by every adapter.
- `StoryblokCmsAdapter` returns agnostic `CMSPage` via `mapper.mapPage(...)`; `getEditableProps` extracts `_editable`→`data-blok-*`; `BridgeScript = StoryblokBridgeScript`. No `<StoryblokStory>`, no `renderPage`.
- No `storyblok/cms/components/` registry/wrappers. No webhook surface (`handleWebhook`/`mapWebhookPayload`/`WebhookEvent`). No `FallbackCmsAdapter`/`CMS_FALLBACK_PROVIDER`.
- Provider ids: `['storyblok','local','none']` (matches architect's trio; not "mock").
- richtext: custom shared `Richtext` component with `blocks(heading/paragraph/list/image/quote/code/hr)` + `inlines(text/link/br)` + marks bold/italic/code/underline/strike. Supports image/quote(blockquote)/code(code_block) — the OPPOSITE of the architect's "bewusst NICHT supported" list (that list was template-derived too).

**Trap in jest.config.js:** the 2× "ADR 0001" comments AND the testMatch/testPathIgnore globs reference the TEMPLATE architecture (`*.render-page.test.tsx`, `storyblok/cms/components/**/*.test.tsx`, "adapter-owned renderPage", "Storyblok component wrappers"). Those test files + the `components/` dir do NOT exist in showcase → dead globs ported from template. So jest.config describes renderPage; all actual code describes central renderer.

**RESOLVED 2026-05-27 (commit 230c9f77 / docs commit 15fa13cc):** Architect re-authored + committed BOTH ADRs to the central-renderer reality (ADR 0001 now lists "provider-owned renderPage" as a REJECTED alternative, not the decision). So the conflict is gone: docs match code AND the committed ADRs. cms-framework.md (central-renderer) + local-cms.md refresh were writable straight against showcase code. The jest.config dead globs (`*.render-page.test.tsx`, `storyblok/cms/components/**`) confirmed dead via `find` (zero matches; storyblok cms tests live under `impl/`, not a `components/` dir) and pruned — full `npm run jest` stayed at exactly 1097/114. Also corrected a 3rd stale jest comment: the Platform-project js-transform comment claimed `storyblokInit({ components })` pulls a registry — but `StoryblokCmsApi` now calls `storyblokInit` with `apiPlugin` only, no components; the transform is still load-bearing (storyblok adapter chain transitively pulls next-intl via the shared CMS render layer), only its rationale was wrong.

**Why this WAS an Architect call (kept for the pattern):** ADR 0001 + cms-framework.md couldn't be written to match BOTH the code and the (then-stale) jest.config comments. The decision of which architecture to document was load-bearing and outside doc scope. Surfacing it to the Architect was correct — they fixed the ADRs first, then the doc port became mechanical.

**How to apply:** When porting docs between the two repos, diff the SPI (`CmsAdapter.d.ts`) FIRST — `renderPage` present or not is the single tell for which architecture you're in. Do not assume template==showcase. Surface the architecture-mismatch + dead jest.config globs to the architect before writing ADR 0001 / cms-framework.md. ADR 0002 + local-cms.md refresh are independently writable.
