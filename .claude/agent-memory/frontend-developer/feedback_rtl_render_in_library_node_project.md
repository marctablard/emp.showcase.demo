---
name: feedback-rtl-render-in-library-node-project
description: RTL `render(...)` in `src/lib/__tests__/*.test.tsx` crashes with "document is not defined" because Library Tests jest project is node-env, not jsdom.
metadata:
  type: feedback
---

`src/lib/__tests__/*.test.tsx` files that import `@testing-library/react`'s `render` cannot pass in the current jest config — the Library Tests project (`testMatch: ['**/lib/**/?(*.)+(spec|test).ts?(x)']`) runs `testEnvironment: 'node'`. Any `render(element)` call throws `ReferenceError: document is not defined`.

**Why:** Library Tests is node-only by design (server-side libs); React/RTL belongs to the `React Tests` project (jsdom). Pre-Implementation `editor-route.test.tsx` was put in `src/lib/__tests__/` as a "Workaround-Lokation" per the architect, knowing those tests can't go green without one of: (a) `@jest-environment jsdom` directive in the test file (test mod — forbidden), (b) moving the file to React Tests (jest-config change — forbidden), or (c) eliminating the `render(...)` calls in the test (test mod — forbidden).

**How to apply:** Do NOT promise these tests go green in Build-Modus output without an explicit config/test waiver. Flag them as "unfixable without config-or-test mod" and surface in the report so the architect can decide whether to relax constraints. Same pattern would apply to any future `.test.tsx` placed in `src/lib/__tests__/` — only pure logic tests (no RTL render) belong there.

Related: [[feedback_jest_resetallmocks_factory_impl]] — even if the env issue were solved, the test's `jest.mock(..., () => ({ getCmsService: jest.fn(async () => ({...})) }))` factory loses its impl after the platform's global `afterEach(resetAllMocks)`, so the fallback branch hits `cms.renderPage` on `undefined`.
