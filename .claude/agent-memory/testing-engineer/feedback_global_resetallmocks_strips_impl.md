---
name: global-resetallmocks-strips-impl
description: Global afterEach(jest.resetAllMocks()) strips mock implementations; a file-local beforeEach must reinstall impl with mockReturnValue, not just mockClear.
metadata:
  type: feedback
---

When a React-project test file (`jest.react.setup.js`) defines a module-level `jest.fn(() => VALUE)` (e.g. a `storyblokEditableSpy`), the global `afterEach(jest.resetAllMocks())` in `jest.react.setup.js` **strips the implementation** after every test. From test 2 onward the spy returns `undefined`.

**Why:** `mockClear()` only resets call history — it does NOT restore the implementation. `resetAllMocks()` resets both impl and history. So a file-local `beforeEach(() => spy.mockClear())` is insufficient: history is already cleared by the global reset, and the impl is gone. Symptom in SHOW-323 Slice 6.3: `top-banner-announcement` wrapper test's `data-blok-*` spread assert got `Received: null` because `storyblokEditable` returned `undefined` from test 2 on. This is a HARNESS defect, not a code bug — the production spread worked; the spy lied.

**How to apply:**
1. Fix in the **test file** (`beforeEach(() => spy.mockReturnValue(VALUE))`), NOT the global setup — ~11 React tests depend on the `resetAllMocks` reset semantics; changing the global setup is out of scope and risky.
2. `mockReturnValue` reinstalls impl WITHOUT adding a call — combined with the global `afterEach` history-clear, each test starts at 0 calls + valid impl, so `toHaveBeenCalledTimes(n)` asserts stay correct.
3. This is a **setup fix, not an assert-loosening** — the strict `expect(...).toBe(EDITABLE_ATTRS[...])` stays untouched. Verify the test now passes for the RIGHT reason (spy returns the sentinel), not because the assert was weakened.
4. In Cross-Review F5 (pitfalls), scan other new React-project test files for the same module-level-spy-with-impl pattern guarded only by `mockClear()`.

**Same pitfall in `jest.mock` factory bodies (platform/library projects too):** an inline factory like

```ts
jest.mock('@/x', () => ({ getX: jest.fn(async () => ({...})) }));
```

works on the FIRST test only. The global `afterEach(jest.resetAllMocks)` (`jest.platform.setup.js`) strips the implementation of every `jest.fn()`, including the one created inside the module-mock factory. From test 2 onward `getX()` returns `undefined`. Fix: expose a top-level `mockGetX = jest.fn()` reference, point the factory at `(...args) => mockGetX(...args)`, and re-seed via `mockGetX.mockImplementation(...)` in `beforeEach`. SHOW-323 editor-route acceptance was bitten by this — first test got `document is not defined` (separate jsdom-env issue), tests 2-4 got `Cannot read properties of undefined (reading 'renderPage')`.
