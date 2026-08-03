---
name: env-guard-ast-selectors
description: AST-selector patterns for ESLint no-restricted-syntax env-guards must cover 3 shapes (dot/computed/destructuring); aliased indirection needs bundle-smoke layer.
metadata:
  type: feedback
---

When pinning `process.env.NEXT_PUBLIC_FOO` (or any guarded global access) via `no-restricted-syntax`, a single `MemberExpression` selector covers ONLY dot-notation. Three selectors are needed at the AST layer:

1. **Dot-notation** (`process.env.FOO`):
   `MemberExpression[object.object.name='process'][object.property.name='env'][property.name=/^FOO_/]`
2. **Computed/bracket** (`process.env['FOO']`):
   `MemberExpression[object.object.name='process'][object.property.name='env'][computed=true][property.value=/^FOO_/]`
3. **Destructuring** (`const { FOO } = process.env`):
   `VariableDeclarator[init.object.name='process'][init.property.name='env'] > ObjectPattern > Property[key.name=/^FOO_/]`

**Aliased indirection** (`const e = process.env; e.FOO`) is **not catchable at the AST layer** — track it at the bundle-smoke layer (e.g. `scripts/preview-smoke.sh` greps the built bundle for the forbidden key).

**Why:** Cross-Review (EMP-21 Phase D, frontend-developer) flagged the single-selector version as a minor with 3 documented bypass vectors. Approve-discipline requires 0 findings, so loophole-closing was mandatory. Verified empirically: with all three selectors enabled, a 4-pattern demo file produced 3 errors (dot/computed/destructuring) + 1 pass (positive control `NEXT_PUBLIC_DEFAULT_CURRENCY`) + 1 known-uncovered aliased read.

**How to apply:** Whenever asked to harden an env-key guard (or any `process.env.*` / `globalThis.*` access pin), default to the 3-selector pattern AND document the aliased-indirection gap with a pointer to the runtime/bundle defense layer. Related: [[eslint-globalignores-tests]] for the test-file ignore interaction.
