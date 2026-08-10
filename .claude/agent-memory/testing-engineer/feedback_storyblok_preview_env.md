---
name: storyblok-preview-env-required-for-editable-anchors
description: Storyblok Visual-Editor anchors (data-blok-c) require draft-mode env opt-in; without it published-mode strips _editable markers.
metadata:
  type: feedback
---

For the Storyblok Visual Editor anchors to render (`data-blok-c` and `data-blok-uid` on `cms-*` wrappers), the Storyblok CDN must be queried with `version=draft`. The integration code reads that toggle from `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` (see `StoryblokCmsApi.resolveVersion()`). When the env var is missing, `version=published` is used and the Storyblok CDN strips the `_editable` payload, so `storyblokEditable()` returns `{}` and no `data-blok-*` attributes ever land on the DOM.

**Why:** Discovered during SHOW-323 Slice 6.2 browser-smoke. Initial test showed zero `data-blok-c` elements even though the bridge script, adapter, and renderer were all correctly wired. Root cause was the env-toggle, not the code.

**How to apply:** Before testing/verifying Visual-Editor click-anchoring or before recording a "Visual Editor not working" finding, check that `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW=true` is in `.env.local`. The bridge script itself loads regardless (gated by `?_storyblok_tk=` in the URL), but the anchors only render under draft mode.
