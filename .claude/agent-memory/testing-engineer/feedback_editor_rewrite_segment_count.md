---
name: editor-rewrite-segment-count
description: Editor-rewrite target must include BOTH [site] and [locale] segments — `/editor/<locale>` collapses [locale] and 404s.
metadata:
  type: feedback
---

When pinning a rewrite-target for the Storyblok editor route, the target pathname MUST satisfy the route's dynamic-segment shape `/editor/[site]/[locale]/[[...slug]]`. Two required segments — `[site]` and `[locale]` — followed by an optional catch-all.

**Why:** During SHOW-323 cross-review, contract test 1 pinned `/editor/de` as the target for site-prefix-less Editor calls (`/de?_storyblok_tk[...]`). Test green, but the editor route doesn't render: Next.js maps `[site]='de'` and `[locale]=undefined`, no overload for missing required segment, route 404s. The compile-target ≠ semantic-target trap. Live probe confirmed: `/editor/de` returns the Next.js 404 boundary, while `/editor/main/de` shows the `data-editor-route="storyblok-fallback"` marker.

**How to apply:** When writing tests for the Editor-rewrite path, the regex must require both segments. Pattern: `/^\/editor\/<site>\/<locale>(\/|$)/`. Reject `/^\/editor\/<locale>/` shapes — they bypass the route shape. Equivalent rule for the implementation: middleware must site-resolve BEFORE constructing the rewrite-target, not just prepend `/editor` to the original path. Related: [[https-dev-server]] (Storyblok editor preview is served via HTTPS in dev).
