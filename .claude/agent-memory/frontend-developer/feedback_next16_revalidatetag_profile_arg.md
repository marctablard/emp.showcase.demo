---
name: next16-revalidatetag-profile-arg
description: Next 16 revalidateTag requires a second `profile` arg in its TS type (single-arg is runtime-deprecated). Conflicts with test contracts that assert single-arg calls via toHaveBeenCalledWith.
metadata:
  type: feedback
---

Next.js 16 changed `revalidateTag`'s signature to
`revalidateTag(tag: string, profile: string | CacheLifeConfig): undefined`.
The second `profile` arg is **required by the TypeScript type** (only one
declaration, no single-arg overload). At runtime single-arg still works but
emits a console deprecation warning recommending `'max'` or `updateTag`.

**Why:** SHOW-323 Slice 6.4 DR6 wired the CMS webhook to `revalidateTag`.
The testing-engineer's final (untouchable) webhook test asserts
`expect(mockRevalidateTag).toHaveBeenCalledWith('cms:story:home')` — a
SINGLE-arg call. jest's `toHaveBeenCalledWith` matches ALL args, so passing
`'max'` as the 2nd arg fails the assertion. But `npx tsc --noEmit` (a quality
gate) fails `TS2554: Expected 2 arguments, but got 1` on the single-arg call.
`npm run build` runs the same type-checker so it fails too. ts-jest with
isolatedModules does NOT enforce cross-file arity, so the single-arg call
passes `npm run jest` — masking the conflict if you only run jest.

**How to apply:** When wiring `revalidateTag` under Next 16, this is a
hard conflict between a single-arg test contract and the typed API. Do NOT
silently `@ts-expect-error`/cast (suppresses a real API signal) and do NOT
touch the final test — escalate to the architect. The two clean resolutions
(architect's call): (a) update the test to expect `revalidateTag(tag, 'max')`
and pass `'max'` in impl, or (b) keep single-arg and add a deliberate,
commented type-suppression with architect sign-off. Either changes a
gate/contract, so it's a Stop-and-Ask, not an autonomous fix.
