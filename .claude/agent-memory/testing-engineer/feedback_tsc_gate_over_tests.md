---
name: tsc-gate-over-tests
description: jest (swc) does not typecheck; type errors in .test.ts files only surface under `tsc --noEmit` — run it on test files too.
metadata:
  type: feedback
---

`tsc --noEmit` must cover test files, not only source. jest uses swc, which
transpiles without typechecking — type errors in `*.test.ts(x)` run green under
jest and slip through PR review.

**Why:** In SHOW-323 Phase B', `NullCmsAdapter.test.ts` accessed optional SPI
members (`getEditableProps` / `BridgeScript`) on a variable typed as the concrete
class that doesn't declare them → `TS2339`. jest was tolerant; the errors rode
through multiple PRs until an Architect-CR ran `tsc --noEmit` and caught 2 errors.

**How to apply:** When reviewing or finishing test-file work, treat
`npx tsc --noEmit` (exit 0, 0 errors) as a required gate alongside jest+lint —
jest-green alone is not proof of type-correctness. Common fix for "test accesses
optional SPI member to assert it's undefined": annotate the variable as the SPI
interface (which declares the member as optional `?`), not the concrete class.
Widen the static type only; never loosen the assertion.
