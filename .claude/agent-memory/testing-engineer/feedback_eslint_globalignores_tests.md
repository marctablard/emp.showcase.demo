---
name: eslint-globalignores-tests
description: ESLint flat config globalIgnores already excludes *.test.{ts,tsx}; source-text audit pins (string-literal env names) can coexist with `no-restricted-syntax` rules that forbid the same names as MemberExpressions.
metadata:
  type: project
---

`eslint.config.mjs` `globalIgnores([...])` already lists `**/*.test.ts` and `**/*.test.tsx`. ESLint never lints test files.

**Why:** when adding `no-restricted-syntax` AST rules that forbid `process.env.FOO_*` reads (e.g. EMP-21 Phase D drift guard for `NEXT_PUBLIC_STORYBLOK_*`/`NEXT_PUBLIC_CMS_*`), the rule cannot collide with source-text audit pins like `expect(source).not.toMatch(/process\.env\.NEXT_PUBLIC_FOO/)` in tests — for two independent reasons:

1. Test files aren't linted at all.
2. Even if they were, the AST selector (`MemberExpression[...]`) matches code, not string literals — `'process.env.NEXT_PUBLIC_FOO'` inside a regex/string is a `Literal` node, not a `MemberExpression`.

**How to apply:** when tightening ESLint to forbid an `env`-read pattern, no test-file override is needed. Verify by lint-running a temp file with the forbidden pattern (must fail) and confirm the full lint stays green (existing source-audit pins untouched). Verified on commit `261348b1` for `NEXT_PUBLIC_(STORYBLOK|CMS)_*`.
