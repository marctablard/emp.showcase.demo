---
name: feedback-show323-container-bootstrap-sequence
description: SHOW-323 showcase container init — `instrumentation.ts::register()` exists, runs once on Next.js Node-runtime boot. CmsAdapter alias-binding fits naturally after the existing logger/metrics bootstrap.
metadata:
  type: feedback
---

Showcase's `src/instrumentation.ts::register()` already does the heavy bootstrap: max listeners, dynamic-import `@/platform/server`, logger + metrics, then `runStartupHealthcheck`. Both `server.default` and `ssr.default` are eager-initialised containers — their `modules`-array is fully bound by the time `register()` runs. Adding a `container.bind('CmsAdapter').toService('CmsAdapter:<id>')` step right before `runStartupHealthcheck` is safe and uses the already-imported logger for the unbound-target fallback warning.

**Why:** [[feedback-di-container-module-graph-split]] warned about ENV-driven aliases landing on a different container instance than the render path. With the showcase container architecture, that risk is low: both `server.default` and `ssr.default` are direct module exports of pre-built `Container` instances, and the dynamic `import('@/platform/{server,ssr}')` inside `register()` resolves to the SAME instances every `inject('CmsAdapter')` consumer sees. The `getServer()`-lazy-init pattern from the source repo is not used here.

**How to apply:** For future SHOW-323-port phases that need ENV-driven DI aliasing, alias-bind in `instrumentation.ts::register()` — no separate `cms-binding.ts` side-effect module needed in showcase. Guard each `bind()` with `container.isBound(target)` so unconfigured adapters (e.g. when only one provider impl is registered) don't crash boot; emit a logger.warn instead.

Verify: `npm run generate` first; check `src/platform/{server,ssr}.ts` contains the adapter imports in the `modules` array. Without that, the `isBound(target)`-guard short-circuits and the alias is silently absent.
