---
name: no-direct-instantiation-audit
description: Source-text audit pattern to pin "X must NOT be instantiated directly" invariants at the file level, robust to comment-noise.
metadata:
  type: feedback
---

For "MUST go through DI resolver, NOT `new Foo(...)` directly" architectural invariants, write a source-audit test that reads the consumer file with `readFileSync`, strips both `/* ... */` and `//` comments, then asserts `not.toMatch(/\bnew\s+Foo\s*\(/)`.

**Why:** runtime mocks of the DI resolver let a sloppy impl satisfy the test even with a parallel `new Foo()` instance somewhere — the seam only verifies "DI was called", not "DI was the only source". Source-text audit pins the invariant at the file level. Architect's Finding 2 (SHOW-323) reproduced exactly this gap.

**How to apply:** add the source-audit case inside the same suite as the runtime-mock contract (next to `describe('source-audit')`). Strip comments before grep so narrative documentation that mentions the forbidden pattern (e.g. "do not call `new Foo(...)`") does not false-positive. The audit is robust whether the consumer file compiles or not — read it as text, never `require` it for the audit.

Related: [[deletion-guard-pattern]] for the inverse (file must EXIST and contain X) and [[storyblok-preview-env]] for editor-bound test scaffolding.
