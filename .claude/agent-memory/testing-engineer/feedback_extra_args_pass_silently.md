---
name: extra-positional-args-pass-silently
description: JS calls silently accept extra positional args; an "accepts options arg" contract test passes for adapters that don't yet read it, so the contract needs a side-effect-bearing assertion to be real-failing.
metadata:
  type: feedback
---

A contract test in the shape of `await expect(adapter.getPage('a','b','c', { …extra }))).resolves.toBeDefined()` passes against every adapter — even those whose `getPage` signature has only 3 params — because JS silently drops extra positional args at runtime. So pinning "method accepts an optional options arg" via the no-reject invariant is NOT a real-failing assertion; the contract test stays green even when no impl exists.

**Why:** Discovered while writing the SPI-extension contract for `CmsAdapter.getPage(slug, locale, site, options?)`. The contract suite passed across Null/Mock/Storyblok without any impl change. The actual failing assertion has to be one that observes a SIDE EFFECT of `options` being passed through (e.g. `expect(downstreamSpy).toHaveBeenCalledWith(..., optionsValue)`), not the method's tolerance of the call.

**How to apply:** When writing Pre-Implementation contract tests for "accepts new optional arg", co-author at least ONE side-effect-bearing assertion in the same commit (in the facade or adapter), not just the no-reject invariant on the SPI. Otherwise the commit's "all red" beweis is the wrong file. The cross-adapter no-reject test is still useful as a guardrail; just don't rely on it for the failing-by-design signal. Related: [[pre-implementation-real-failing]].
