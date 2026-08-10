---
name: prose-clean-source-repo-tests
description: When porting source-repo tests as spec-by-example, the assertion contract is reusable but the JSDoc/comment prose must be rewritten to pass the task-internals grep
metadata:
  type: feedback
---

When the source repo (`imported/SHOW-323` in showcase-bare) is used as spec-by-example for porting tests, copy the assertion bodies but REWRITE the prose.

**Why:** SHOW-323 enforces a quality-gate grep on `src/`: `grep -rE "SHOW-323|Slice|Phase [A-G]|RE-CUT|Pattern [A-Z]|DR-|PR-#"` must be 0 hits (see port-plan-v3 Gate 6, [[feedback-no-task-internals-in-code]]). The source-repo test JSDoc is full of task-internals: "Pattern-A", "architect decision F-C", "Variante 2", "Subgraph-Trigger-Check", "migration", "Master", "legacy". The assertion logic is clean; only the narrative comments leak.

**How to apply:**
- Reuse: `describe`/`it` titles, `expect()` assertions, fixtures, `jest.mock` factories — these are the behaviour contract and survive transplant.
- Rewrite: top-of-file JSDoc + inline comments — describe behaviour in plain prose ("renders a link wrapping the title with an ArrowUpRight icon after it"), never how the migration got there.
- Specifically scrub: `Pattern [A-Z]` (space form is what the grep catches; "Pattern-A" hyphenated technically passes but scrub anyway), `Slice`, `Phase X`, decision-codes (`F-C`), `migration`/`Master`/`legacy` framing.
- Keep allowed labels: `ADR 0001`, `data-blok-*`, lucide class names, `@/i18n/navigation` — these are real surface, not task-internals.
- Verify before commit: run the grep on the exact staged file list, expect 0 hits. The lint-staged prettier hook does not strip comments, so a clean grep pre-commit stays clean post-commit.

Related: [[slice3-test-paths]], [[pre-implementation-real-failing]]
