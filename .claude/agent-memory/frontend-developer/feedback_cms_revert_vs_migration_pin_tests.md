---
name: cms-revert-vs-migration-pin-tests
description: A revert decision (e.g. DR2 richtext) collides with pre-existing migration-era pin tests AND tsc; renderer-only revert is the green subset.
metadata:
  type: feedback
---

When an architect decision REVERTS behaviour that the CMS migration introduced (SHOW-323 DR2: drop the invented `image/quote/code` richtext block kinds + the `richtext` wrapper class + list `ml-4`), the revert collides with THREE pre-existing surfaces that the migration locked in:

1. `richtext/schema.ts` Zod union still declares `image/quote/code` — and `richtext/richtext.test.tsx` constructs those literals typed as `RichtextData`. Removing them from the union breaks `npx tsc --noEmit` on the test file (jest still passes — SWC strips types).
2. `StoryblokCmsMapper.test.ts` (NOT flagged for deletion) asserts `mapRichtext` STILL emits `{kind:'quote'|'code'|'image'}`. Reverting the mapper turns these green→red.
3. `StoryblokCmsMapper.behaviour-pin.test.tsx` (Decision 23 / A1) asserts the agnostic renderer emits `<blockquote>`/`<pre><code>`; `article/article.acceptance.test.tsx` asserts the `.richtext` root class is present. The renderer revert turns these green→red.

**Why:** the migration-era pins and the new Pre-Impl revert tests assert OPPOSITE things about the same renderer. A "remove from all 3 surfaces" instruction (SA2) cannot be satisfied without modifying un-flagged acceptance tests + breaking tsc — both forbidden anti-patterns.

**How to apply:** the only revert subset a developer may do UNILATERALLY (keeps tsc + jest green without touching un-flagged tests) is the **renderer-only revert** (remove the renderer cases / wrapper class / list-class move; LEAVE the Zod union + the mapper emitting the kinds). The schema/mapper-surface removal + the obsolete migration pins need an explicit architect call — STOP-AND-ASK, do not silently delete pre-existing tests outside your sanctioned deletions.

**RESOLVED 2026-05-20 (DR2 fully landed):** the architect made that call. testing-engineer first FLIPPED the pins to the reverted contract (`StoryblokCmsMapper.test.ts` quote/code/image now assert `mapRichtext → undefined`; `behaviour-pin` now asserts NO `<blockquote>`/`<pre>`) — turning 4 mapper tests RED — then handed off the schema+mapper revert. With the pins already flipped, the full 3-surface removal (delete the 3 Zod block schemas + union entries; delete the 3 `mapBlock` cases → `default → undefined`) keeps tsc + jest green. Note: `flattenBlockChildInlines` survives the QUOTE removal because `liftListItems` still calls it — NOT dead, do not remove. So the once-blocked removal is green ONLY because the engineer re-pinned first; never attempt it before the contract tests are flipped.
