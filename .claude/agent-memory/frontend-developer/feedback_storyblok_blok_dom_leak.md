---
name: feedback-storyblok-blok-dom-leak
description: Storyblok wrappers blind-spreading mapBlokToProps leak content fields onto DOM; use the keep allowlist param.
metadata:
  type: feedback
---

Storyblok thin wrappers in `src/platform/integrations/storyblok/cms/components/` must NOT blind-spread the full blok onto the shared CMS component. The shared components destructure their known schema fields and forward `...rest` onto a DOM root, so any authored blok field NOT in the shared component's destructure list leaks as a DOM attribute. Boolean/object/array fields trigger React warnings (e.g. `Received \`false\` for a non-boolean attribute \`no_margin\``).

**Why:** `no_margin` is a layout-control field consumed only by the agnostic shell `cms-page.tsx` (reads `page.no_margin` from `getPage`), not by the SDK render path. It leaked via `StoryblokPage` → `<Page>` `...rest` → `<div>`. This is the D4 content-field DOM-leak (ADR 0001) in practice.

**How to apply:** `mapBlokToProps(blok, keep?)` and `makeLeafWrapper(Shared, keep?)` both take an optional `keep` allowlist of authored field-names. Pass the exact agnostic fields the shared component declares as props (mirror its Zod schema, excluding `id`/`type` which are always added). Container wrappers that supply `children` (page=['title'], layout=[]) need few/no authored fields. The `data-blok-*` editable anchor is unaffected — it comes from the separate `storyblokEditable(blok)` spread, never from `mapBlokToProps`. Leak-guard tests assert `root.hasAttribute('no_margin') === false` AND `data-blok-c/uid` still present. Note: React silently drops boolean DOM attrs like `is_active`, so test leaks with an OBJECT field (e.g. `meta`) to make the guard real.
