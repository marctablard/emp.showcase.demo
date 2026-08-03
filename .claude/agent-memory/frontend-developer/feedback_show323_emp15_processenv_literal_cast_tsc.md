---
name: show323-emp15-processenv-literal-cast-tsc
description: EMP-15 contract test casts bare object literal `as NodeJS.ProcessEnv` → TS2352 (NODE_ENV missing); jest(swc) tolerant, tsc rot. Spread-cast is the green pattern.
metadata:
  type: feedback
---

A direct object-literal assertion `{ NEXT_PUBLIC_CMS_PROVIDER: 'storyblok' } as NodeJS.ProcessEnv`
fails `tsc --noEmit` with TS2352 in this repo: the project's `ProcessEnv`
requires `NODE_ENV`, and a too-small object literal can't be directly
asserted. jest's `@swc/jest` transform ignores types, so the test is GREEN
while `tsc`/`next build` go RED.

**Why:** EMP-15 (SHOW-323 Phase F) `preview-detector-registry.test.ts` (a
contract test I may not modify) uses 5 such bare-literal casts. My production
code was fully tsc-clean; all 5 errors were isolated to that one immutable
test file. The sibling `CmsProviderResolver.test.ts` avoids it via
`{ ...partial } as NodeJS.ProcessEnv` (spread widens to a broader type that
asserts cleanly), or `as unknown as NodeJS.ProcessEnv`.

**How to apply:** When a tsc failure is confined to an immutable
acceptance/drift test (verify with `tsc --noEmit 2>&1 | grep error | grep -v <testfile>`
== 0), do NOT silently edit the contract. Report testsGreen=true /
tscClean=false with the isolated cause and recommend the testing-engineer
swap the literal cast for a spread-cast (`{ ...{...} } as NodeJS.ProcessEnv`)
or `as unknown as NodeJS.ProcessEnv`. [[feedback_next16_revalidatetag_profile_arg]]
[[feedback_platform_jest_server_adapter_imports_react_tree]]
