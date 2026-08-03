---
name: pre-implementation-stubs
description: Pre-Implementation contract files use describe.skip with commented-out test bodies (assertions sketched in JS comments). Preserves jest test-count baseline (skipped tests still register as "skipped", suite-count grows) while shipping the test contract before Developer build.
metadata:
  type: feedback
---

When the architect calls me in Pre-Implementation-Mode (write failing-by-design contract tests before Developer implementation), I use `describe.skip` with the actual assertions sketched in JS comments inside the `it()` bodies.

**Why:**
- The Quality-Gates 1 ("`npm run jest` grün, Test-Count steigt oder bleibt gleich") forbids regressing baseline. Failing tests would break Gate 1; pure `it.todo` loses the contract precision.
- The contract precision is what makes Pre-Implementation valuable — the engineer must see "what does the test assert, what shape does the spy expect, what's the AAA structure" before they implement.
- `describe.skip` with commented bodies gives the engineer something to UN-skip and copy into live code per RED-GREEN cycle.

**How to apply:**

For each new test file in Pre-Implementation:

1. Wrap the test contract in `describe.skip('...', () => { ... })`.
2. Inside each `it('...', () => { ... })`, write the test body as block comments:
   ```js
   it('does X when Y', () => {
     // const subject = build({ y: true });
     // const result = subject.x();
     // expect(result).toEqual(expectedX);
   });
   ```
3. Include a top-of-file JSDoc-block explaining:
   - Architekt-Entscheidung reference (A1/A2/...)
   - Behaviour contract being pinned
   - "Skipped until P<N> lands."
4. Avoid runtime imports the engineer hasn't built yet — top-of-file imports stay limited to test helpers (`@testing-library/jest-dom`). Imports of the System-Under-Test live in commented-out bodies.

Verification per commit:
- `npm run jest` reports `<N> skipped, <baseline> passed` — suite-count grew by exactly the number of new files; passed-count is unchanged.

When the engineer implements (TDD-Skill: vertical slice, one test at a time):
- Remove `.skip` on one `describe` block at a time, un-comment ONE `it`-body, watch it go RED, then implement enough to make it GREEN. Repeat.
- The engineer never modifies the contract semantics — they may extend, but the architect's pre-implementation contract is the floor.

Drift-Check during Cross-Review:
- Verify Pre-Implementation `describe.skip` blocks have all been promoted to `describe(...)` with un-commented bodies, no `it()` left half-skipped.
- Verify NO assertion was weakened versus the comment template (per `feedback_test_contract_drift_check`).
