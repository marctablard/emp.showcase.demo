---
name: cms-breadcrumb-provider-coupled
description: The Master CMS buildBreadcrumb walked Storyblok stories per-slug-segment via the SDK; the agnostic post-pivot CMSService SPI has no equivalent, so DR1's breadcrumb-restore needs a re-authored helper.
metadata:
  type: project
---

The Master CMS breadcrumb (release 0.9.9 `storyblok-cms-page.tsx` / `local-cms-page.tsx`) built its trail by calling the Storyblok SDK `getStory` once per slug segment to read each ancestor story's `.name`.

**Why:** SHOW-323 Slice 6.4 DR1 ("Breadcrumb-Restore") asked to restore that strip in the agnostic shell. But the post-pivot `CMSService` SPI (`CMSService.d.ts`) exposes only `getPage(slug, locale, site)` returning a `CMSPage` with `title` (NOT `name`), plus `renderPage`/`getNavigation`/`getLayout`. There is NO per-segment fetch and no breadcrumb field on `CMSPage`. So `buildBreadcrumb` cannot be restored verbatim — it must be re-authored against the agnostic page API. This was the slice's named Stop-and-Ask.

**How to apply:** When DR1-style breadcrumb work resurfaces, treat `buildBreadcrumb` as a NEW Shell-level helper (co-located `./build-breadcrumb`), mocked at that seam in the cms-page test. Do not assume a `buildBreadcrumb` exists in `src/` — verify with grep first (it did not, as of 2026-05-20). The data-source (how the agnostic helper resolves ancestor labels without the SDK) is an open architect decision.
