---
name: processenv-literal-cast
description: Bare object-literal `as NodeJS.ProcessEnv` casts fail tsc/next-build (TS2352) because repo ProcessEnv requires NODE_ENV; jest swc ignores it.
metadata:
  type: feedback
---

Casting a too-small object literal to `NodeJS.ProcessEnv` in a test (`{ NEXT_PUBLIC_X: 'y' } as NodeJS.ProcessEnv`) is GREEN under jest (swc strips types) but RED under `tsc --noEmit` / `next build` with TS2352 — this repo augments ProcessEnv to require `NODE_ENV`, so the literal does not sufficiently overlap.

**Why:** `next build` runs a typecheck pass; a TS2352 in any `.test.ts` fails the production build even though jest passes. Caught during EMP-15 Phase F cross-review (preview-detector-registry.test.ts, 5 occurrences).

**How to apply:** Two safe fixes — (a) `as unknown as NodeJS.ProcessEnv` (minimal, used in Phase F fix), or (b) a `buildEnv(partial)` helper that spreads `{ ...partial } as NodeJS.ProcessEnv` (the sibling pattern in CmsProviderResolver.test.ts:9-11). Both preserve assertions. Always run the `tsc --noEmit` gate over new test files — `npm run jest` alone will not catch this. Reinforces [[tsc-gate-over-tests]].
