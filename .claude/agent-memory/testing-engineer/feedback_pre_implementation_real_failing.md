---
name: pre-implementation-real-failing
description: Per-slice override of the describe.skip pattern — some architects request real failing tests for the Pre-Implementation contract, not skipped stubs. Identify the architect's choice from the slice plan, not the agent-memory default.
metadata:
  type: feedback
---

When the architect of a slice explicitly requests **real failing tests** (rather than the `describe.skip` baseline-preserving stubs from [[pre-implementation-stubs]]), follow the architect's choice for that slice.

**Why:** SHOW-323 Slice 6.3 architect explicitly said "Echte failing Tests, keine `describe.skip`. Failing weil die Implementation noch fehlt — nicht weil der Assertion-Sinn fehlt." The Pre-Implementation policy is per-slice — different architects can choose differently. The pre-impl-stubs memory remains the default unless overridden.

**How to apply:**

When called in Pre-Implementation-Mode, look at the slice plan for an explicit instruction on the failing-test shape:

1. **`describe.skip` + commented bodies** — baseline-preserving (Gate 1 "Test-Count steigt oder bleibt gleich" never fires negative deltas in failed tests). Use for slices where the architect cares about a clean failing-test count baseline.

2. **Real failing tests** — `expect()` assertions that fail because the implementation is absent. Use for slices where the architect prefers the Pre-Impl-Contract to be immediately runnable as a red-test gate for the developer ("first un-skipping is implicit — the test is already failing").

Both modes:
- Verify with `npx jest <files>` that the failures are because of **missing implementation**, not setup errors. "Cannot find module" / "expected undefined" failures are the gold standard; assertion-shape failures should not appear at this stage.

**Task-internal codes** (decision-codes like `LE1` / `DR2`, slice numbers, ticket IDs):
- The default has flipped — most architects now enforce a grep-gate against any task-internal mention in test files (`SHOW-XXX`, `Slice N`, `Decision N`, `Architekt-Entscheidung`, single-letter+digit codes like `E3`, `TH4`). Tests must describe behaviour in plain prose.
- Only the cleanly-renamed labels (e.g. `ADR 0001`) are allowed — these survive a future repo-history transplant; task-internal codes do not.
- When you write Pre-Impl tests, default to NO task-internal codes. If an architect explicitly asks for decision-code traceability, ask once and confirm before sprinkling them in.

**Drift-Check during Cross-Review** (per [[test-contract-drift-check]]):
- For "real failing tests" mode, the dev MAY remove obsolete tests that pin pre-revert behaviour explicitly named in the architect's revert decisions (e.g. DR2 / DR3 in 6.3). Document each removal in the PR-body so the drift-check can reconcile it with the architect-decision.
- The dev MAY NOT loosen the failing-test assertions to make them pass. Each assertion is a contract; broken contracts mean broken implementation.
