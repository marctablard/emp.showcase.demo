---
name: deletion-guard-pattern
description: Pre-impl deletion-guard tests must use require.resolve probes + source-text audits, never static imports, so the test file keeps compiling after the target modules are removed.
metadata:
  type: feedback
---

When writing a Pre-Implementation deletion-guard (a red test that verifies code/modules are GONE after the dev removes them), the test must stay COMPILABLE both before and after the deletion.

**Why:** A static `import { x } from '../dead-module'` makes the test file un-compilable once the dev deletes `dead-module` — the guard would then fail with a TS/module-resolution error in CI instead of passing. The guard's job is to flip red→green on deletion, not to break the build.

**How to apply:**
1. **Module-existence checks**: wrap `require.resolve('../module')` in try/catch; success-signal is the throw (`expect(isResolvable('../page-cache')).toBe(false)`). Pre-impl: resolves → red. Post-deletion: throws → green.
2. **SPI/method/import removal checks**: read the source file as TEXT (`readFileSync(resolve(__dirname, '../CmsAdapter.d.ts'), 'utf8')`) and assert `expect(src).not.toMatch(/getLayout/)`. Source-audit, not type-level — survives the symbol's deletion.
3. **Replacement-presence**: also assert the new construct IS present (`expect(serviceSrc).toMatch(/from 'next\/cache'/)`) so the guard pins the migration direction, not just absence.
4. Used in SHOW-323 Slice 6.4 DR6 (`cms-cache-debris-removed.deletion.test.ts`) — page/layout-cache + cache-invalidator + getLayout removal. All red at pre-impl for "present-but-should-be-absent", green once dev deletes.
