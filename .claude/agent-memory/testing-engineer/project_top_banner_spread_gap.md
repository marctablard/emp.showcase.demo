---
name: top-banner-announcement-missing-rest-spread
description: TopBannerAnnouncement CMS component does not accept/forward HTMLAttributes rest spread, so data-blok-* attrs never reach the DOM.
metadata:
  type: project
---

`src/components/cms/top-banner-announcement/top-banner-announcement.tsx` destructures only the schema fields (`id`, `type`, `title`, `link`, `is_active`) — no `...rest` spread, no forwarding to the rendered `<UiLink>`. The CMS renderer (`cms-renderer.tsx`) passes `editableProps` via `<Component {...editableProps} />`, but those are dropped at this component boundary.

All other Storyblok-mapped components in the registry (hero, feature, content-block, button, logo, etc.) correctly use `({ id: _id, type: _type, ..., className, ...rest })` and spread `{...rest}` on the root element. Top-banner-announcement is the outlier.

**Why:** Discovered during SHOW-323 Slice 6.2 browser-smoke. Out of 8 rendered Storyblok components in the layout+page tree, 7 had `data-blok-c` on their wrapper; only the top-banner-announcement link was missing it. Visual Editor cannot anchor edit-clicks to it.

**How to apply:** When reviewing CMS-component PRs, every component reachable via the `cmsComponentMap` must accept `...rest` from `HTMLAttributes<HTMLElement>` and spread it on its root DOM element. Architect-level fix for top-banner-announcement is needed (testing-engineer scope does not patch Production code). Other components should be audited against the same invariant.
