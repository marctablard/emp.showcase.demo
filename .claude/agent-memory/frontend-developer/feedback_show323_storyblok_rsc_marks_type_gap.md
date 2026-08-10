---
name: feedback-show323-storyblok-rsc-marks-type-gap
description: SHOW-323 — @storyblok/react/rsc StoryblokRichTextNode type omits `marks`/`text`; jest (swc) tolerates node.marks, tsc/next build rejects (TS2339).
metadata:
  type: feedback
---

`StoryblokRichTextNode<string>` from `@storyblok/react/rsc` does NOT expose `.marks` or `.text` on its public type (only `.type`, `.content`, `.attrs`). Accessing `node.marks` / `node.text` directly compiles under jest (swc transform, loose) but fails `tsc --noEmit` / `next build` with TS2339.

**Why:** jest's swc transform does not do full structural type-checking; only the real `tsc` in `next build` does. A mapper that reads `node.marks` looks green in `npm run jest` but reds the build.

**How to apply:** When reading TipTap text-node fields the SDK type omits, cast first: `const t = node as { text?: string; marks?: Array<{ type: string; attrs?: Record<string, unknown> }> };`. Always run `npx tsc --noEmit` (not just jest) before declaring a Storyblok-mapper green. Enum values live in `@storyblok/richtext` source maps (`BlockTypes`/`MarkTypes`/`TextTypes`); `HR='horizontal_rule'`, `BR='hard_break'`, `STRONG`/`BOLD` both → bold, `UL_LIST='bullet_list'`, `OL_LIST='ordered_list'`.
