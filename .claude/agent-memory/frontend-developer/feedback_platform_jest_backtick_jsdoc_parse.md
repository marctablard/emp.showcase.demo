---
name: platform-jest-backtick-jsdoc-parse
description: Platform-Jest transform mis-parses JSDoc with many backtick-pairs as an unterminated template literal (TS1160) in model/services .ts files.
metadata:
  type: feedback
---

In Platform-project Jest, a runtime `.ts` under `src/platform/services/**` whose JSDoc block comment contains many inline-code backtick pairs (`` `getPage` ``, `` `{ notfound: false }` ``, etc.) can fail to compile with `TS1160: Unterminated template literal`, pointing at the file's last line. Jest grün only after the backticks are removed from the comment.

**Why:** the Platform Jest transform is a lightweight/regex-based pre-processor (not full tsc); odd backtick balancing across comment lines makes it think a template literal is open. Pure-React-project files do not hit this.

**How to apply:** when adding a new runtime `.ts` in the platform/services/model layer and a fresh test fails with TS1160 on a comment-heavy file, strip inline-code backticks from the JSDoc (use plain words) rather than chasing a phantom template literal. tsc itself is fine with the backticks — this is jest-transform-only.
