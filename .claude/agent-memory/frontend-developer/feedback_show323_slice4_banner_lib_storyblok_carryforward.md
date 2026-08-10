---
name: feedback-show323-slice4-banner-lib-storyblok-carryforward
description: SHOW-323 Slice 4 — lib/storyblok.ts cannot be fully deleted; use-banner.ts is a browser-side caller with no agnostic SPI path. Slimmed, not removed.
metadata:
  type: feedback
---

Slice-4 brief listed `src/lib/storyblok.ts` for deletion, but `src/hooks/banner/use-banner.ts` (client hook) imports `getStoryblokApi` from it to fetch the top-banner story via `storyblokApi.get('cdn/stories/top-banner-announcement', ...)` — a raw arbitrary-story SDK call in the BROWSER. The agnostic `StoryblokCmsApi` only exposes `getStory(slug)` (page SPI) and is server-only; there is no agnostic browser path for arbitrary banner stories, and no test covers a banner migration.

**Resolution (scoped, green):** Kept `lib/storyblok.ts` alive but SLIMMED it to just the token-guarded `getStoryblokApi` accessor — dropped the render `components: {...}` map block (Page/ContentBlock/Hero/etc.) that fed the now-deleted `StoryblokStory` render path. This removes the Direct-vs-Wrapped runtime-regression risk ([[feedback-show323-storyblok-directly-registered-components]]) AND satisfies "component-map is now the single render source", while the banner keeps working. Deleted: StoryblokProvider, storyblok-cms-page, storyblok-component, cms-component-renderer (all render-path).

**Why:** Fully deleting `lib/storyblok.ts` would break the banner with no test-covered replacement; migrating the banner to an API route is a larger, untested change outside Slice-4 scope and is architecture-relevant (browser SDK access).

**How to apply:** Flag the banner's browser-side `getStoryblokApi` usage to the architect as a known carry-forward — a future phase should either add an agnostic banner-fetch SPI/API-route or accept the thin `lib/storyblok.ts` accessor as the permanent banner path. Do NOT attempt the banner migration inside a render-pipeline slice.
