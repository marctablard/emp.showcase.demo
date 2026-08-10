---
name: test-files-module-scope
description: Test files in the same dir without top-level imports collide in tsc's global script scope; add `export {}` to mark as TS module.
metadata:
  type: feedback
---

Two `*.test.ts` files in the same directory that have NO top-level `import`/`export` statements (only `jest.mock(...)` factories and inline test code) are treated by TypeScript as **global scripts**, not modules. Their top-level `const`/`function` declarations then collide across files and produce `TS2451 Cannot redeclare block-scoped variable` plus downstream `TS2554 Expected 0 arguments` on completely unrelated calls.

**Why:** SHOW-323 EMP-21 Phase C added a second `_actions/*.test.ts` next to the existing Phase-B `storyblok-bridge.test.ts`. Both used `const mockLoggerWarn = jest.fn()` and a private `async function loadAction()` at top level. `npm run jest` was happy (swc transpiles per-file in isolation), but `npx tsc --noEmit` reported 19 errors across both files. Same trap will hit any subsequent `_actions/*.test.ts` addition.

**How to apply:**
1. In the **new** test file add `export {}` as the first non-comment line (a no-cost ESM-module marker). The existing file in the directory needs no change as long as it remains the only "script" — but if a third file lands, every new file should also carry the marker so the order of edits does not matter.
2. Alternative: a real `import type { ... } from '...'` at the top works too (any top-level `import`/`export` statement promotes the file to module scope).
3. `jest.mock('@/foo', () => ({...}))` is NOT a top-level import in TS's eyes; it is a `jest`-namespace function call. It does not promote module scope.
4. Catch this in the `tsc` gate, not in jest — jest's swc transpiler does not surface the collision.
