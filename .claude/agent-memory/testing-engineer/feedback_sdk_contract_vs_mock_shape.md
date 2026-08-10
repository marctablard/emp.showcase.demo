---
name: sdk-contract-vs-mock-shape
description: Pre-Impl test mocks must match the real SDK shape per its .d.ts contract, not the shape the action's author assumed; mock-shape drift hides real production bugs.
metadata:
  type: feedback
---

When writing Pre-Impl tests against a third-party SDK (e.g. `@storyblok/react/rsc`), the mock factory MUST mirror the SDK's published `.d.ts` contract, not a simplified guess at the SDK shape.

**Concrete case (EMP-21 Phase C, cms-banner action):**
`@storyblok/react/rsc.storyblokInit` returns `(() => StoryblokClient)` — an *accessor function* that must be invoked. The Pre-Impl mock returned a direct client shape `{ get: jest.fn() }` instead of the accessor wrapper. The Library jest tests went green because the production code under test was written to match the (wrong) mock — `storyblokInit({...}).get(...)` — instead of the real SDK shape — `storyblokInit({...})().get(...)`. This would have crashed in production with `api.get is not a function` on every banner fetch. The bug only surfaced during cross-review when the architect cross-referenced `StoryblokCmsApi.ts:74-90` (which uses the same SDK correctly).

**Why:** Pre-Impl tests act as the implementation's first guide — if the mock shape diverges from the SDK's real shape, the developer will implement against the mock and ship code that runtime-crashes against the real SDK. The test passing is a false signal of contract conformance.

**How to apply:** Before writing the mock factory for an SDK module, open the SDK's `node_modules/<pkg>/dist/*.d.ts` (or the published types) and copy the call signature exactly. For factory-returning-accessor patterns (storyblokInit, signal-style factories, lazy initializers), the mock MUST replicate the accessor shape, never short-circuit to the inner client. Cross-check at least one existing internal call-site that already uses the SDK correctly (e.g. another adapter using the same SDK) — if the mock differs, the mock is wrong, not the call-site. See also [[composite-mirrors-webhook-primitive-pair]] for a related "mock the contract, not the convenient shape" pattern.
