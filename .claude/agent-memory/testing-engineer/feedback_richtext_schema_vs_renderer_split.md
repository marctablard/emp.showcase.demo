---
name: richtext-schema-vs-renderer-split
description: Richtext block kinds live in BOTH the Zod schema (schema.ts) and the renderer switch (richtext.tsx); reverting renderer-only block kinds without touching the schema risks a non-exhaustive switch (TS) and unrenderable mapper output.
metadata:
  type: feedback
---

The agnostic `richtext` component splits its block AST across two files: `richtext/schema.ts` (Zod discriminated union of block kinds — `heading/paragraph/list/image/quote/code/hr`) and `richtext/richtext.tsx` (`renderBlock` switch, exhaustive over that union). The Storyblok mapper (`StoryblokCmsMapper.mapBlock`) PRODUCES `image/quote/code` blocks.

**Why:** SHOW-323 Slice 6.4 DR2 said "remove invented block kinds (blockquote/code/image) → Text-Default" but listed ONLY `richtext.tsx` in scope. Removing the `case` branches from the renderer without removing the kinds from `schema.ts` makes the switch non-exhaustive (TS strict error) AND leaves the mapper emitting blocks the renderer can no longer render. The schema, renderer, and mapper are three coupled surfaces for one decision.

**How to apply:** When a DR reverts/removes a richtext (or any registry-component) block/inline kind, flag the three-surface coupling as a Stop-and-Ask: schema kind removal? mapper emission removal? renderer branch removal? Pin the OBSERVABLE DOM in the test (e.g. "no `<blockquote>` element rendered") rather than schema internals, so the test survives whichever surface the architect chooses to edit. Do not assume renderer-only scope is self-consistent.

**DR2 (SHOW-323 Slice 6.4) reconciliation outcome — which test goes RED vs GREEN when surfaces revert in sequence:** The architect chose a FULL 3-surface revert and did the RENDERER first. Result on the four pin-test files:
- Tests asserting OBSERVABLE DOM (renderer + behaviour-pin: "no `<blockquote>`/`<pre>`/`<img>`") go GREEN immediately once the renderer is reverted — even while the mapper still emits the `quote`/`code`/`image` kinds, because the reverted renderer maps those kinds to plain text/null. DOM-pinned tests are surface-order-independent — the value of pinning DOM.
- Tests asserting MAPPER EMISSION directly (`StoryblokCmsMapper.test.ts`: `mapRichtext(blockquote)` toBeUndefined / blocks not contain `quote`) stay RED until the mapper revert lands. These are the legitimate Red-Green hand-off for the developer.
- Master-faithful target for these TipTap nodes: mapper's `mapBlock` `default → undefined`, `liftToBlocks` drops them → NO block. Master's richtext switch had no QUOTE/CODE_BLOCK/IMAGE resolver; they hit `default: case TEXT` (reads `node.text`, absent → empty). So "drop the node" is faithful, NOT "map to a text/paragraph block".
- The invented `.richtext` wrapper class never actually reached the DOM (article passes `className="mb-8"` to `<Richtext>`; renderer root was `cn(className)`). The acceptance test pinning `.richtext` presence was ALREADY RED at HEAD — re-pin on observable body blocks (getByRole heading / getByText), not the class token.
- Typed-invented-kind constructions in the renderer test (`{kind:'quote'}` as `RichtextData`) must be DELETED (can't survive schema kind removal), not reworked — their behaviour pin moves to the mapper/behaviour-pin layer where the TipTap node actually arrives.
