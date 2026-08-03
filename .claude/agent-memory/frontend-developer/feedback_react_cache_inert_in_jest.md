---
name: react-cache-inert-in-jest
description: React.cache() does not memoize outside a React request/render context, so jest node-env tests cannot observe its dedup; pin behaviour + wrapper presence instead, verify dedup via build/manual trace.
metadata:
  type: feedback
---

`React.cache(fn)` (from `react`) only memoizes INSIDE a React request/render context (RSC request scope). In the jest node-env (Platform Tests, no render context) the cache store does not exist, so the wrapped fn runs on EVERY call — the dedup is inert and a `toHaveBeenCalledTimes(1)` assertion will see N calls, not 1.

**Why:** In SHOW-323 simplify I wrapped `StoryblokCmsApi.getStory`'s SDK fetch in a per-instance `cache(...)` (created in the constructor) to dedup the 3-4 identical `getStory` calls per page-request (generateMetadata + getPage + renderPage + breadcrumb). A first-cut jest test asserting "identical args → 1 SDK call" stayed RED even after the wrapper was correct — because jest has no request context for the cache to live in.

**How to apply:**
- Place `cache()` PER-INSTANCE (constructor field), NOT module scope, when the host is a DI Singleton — React's per-request lifetime does the reset, and a fresh instance per test keeps the existing args-level contract tests hermetic (each `new X()` gets its own cache).
- In jest you CAN pin: (a) the wrapper exists (`typeof instance.fetchStoryCached === 'function'`), (b) delivery is unchanged (same payload returned through the cached path), (c) distinct args still fetch separately (cache never over-collapses), (d) per-instance isolation. You CANNOT pin the same-args dedup count.
- Verify the actual dedup via `npm run build` (the RSC compiler exercises cache usage and fails on misuse) + a manual request trace. Document the limitation in the test file header so a future reader doesn't "fix" the missing count assertion by loosening it.
- Verhaltensneutral only if the cache key is the FULL arg tuple and env-driven resolution (slug/version) is stable within a request — which it is. Keep cheap guards (e.g. no-token early return) OUTSIDE the cache so misses never poison the keyed store.
