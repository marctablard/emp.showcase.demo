---
name: jest-resetallmocks-factory-impl
description: React/Platform jest setup runs global afterEach(jest.resetAllMocks) — wipes implementations set via module-level jest.fn(impl); tests must re-set impl in beforeEach
metadata:
  type: feedback
---

`jest.react.setup.js` and `jest.platform.setup.js` both run a global
`afterEach(() => jest.resetAllMocks())`.

Rule: a mock declared at module scope as `const spy = jest.fn(() => VALUE)`
(common in a `jest.mock('pkg', () => ({ thing: () => spy() }))` factory)
loses its implementation after the FIRST test's afterEach. A `beforeEach`
that only calls `spy.mockClear()` does NOT restore it — `mockClear` keeps
calls cleared but `resetAllMocks` already removed the impl. So the second
and later tests in the file get `undefined` from the spy.

**Why:** `resetAllMocks` === `mockReset` on every mock, which strips the
implementation set by `jest.fn(impl)`. This bit the SHOW-323 Slice 6.3
RE-CUT `top-banner-announcement.test.tsx` (the `storyblokEditable` spy
returned the editable-attrs only for the first test; later tests got
`undefined`, so the `data-blok-*` spread assertion failed).

**How to apply:** when authoring a test whose mock must return a stable
value across multiple `it()`s, re-establish the impl in `beforeEach`
(`spy.mockReturnValue(VALUE)` / `spy.mockImplementation(...)`), not just
`spy.mockClear()`. When DEBUGGING a test that passes in isolation
(`-t "name"`) but fails in the full file, suspect this reset collision
first. Do not "fix" it by changing the global `afterEach` to
`clearAllMocks` — ~11 React-project test files rely on reset semantics;
fix the individual test's beforeEach instead.
