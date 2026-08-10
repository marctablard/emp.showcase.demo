---
name: task-internal-comment-cleanup-grep-scope
description: Beim Entfernen von Task-Decision-Codes aus CMS-Kommentaren reichte der vorgegebene konservative Grep nicht — bare-Codes separat suchen.
metadata:
  type: feedback
---

Beim Strippen von Task-Internals (SHOW-323 PR #10) aus Code-Kommentaren: der im Task vorgegebene Verifikations-Grep war zu eng und hätte die Hälfte der Treffer übersehen.

**Why:** Die vorgegebene Pattern-Liste matchte Decision-Codes nur in *präfixierter* Form (`/ R[0-9]`, `Decisions? R[0-9]`). Die Codebasis enthielt aber pervasive *bare* Codes in Parenthesen: `(R4)`, `(R1)`, `(R10-FIX)`, `(A2)`, `(E3)`, `(D4)`, `architect-decision A1`, plus Workflow-Artefakte `Stop-and-Ask`, `report §7`, `STOP-AND-ASK`. Mehrere Files (hero/feature/button/logo/content-block.tsx) waren *ausschließlich* über bare `(R4)` betroffen und fehlten in der ersten Trefferliste.

**How to apply:** Bei „entferne alle Task-Codes aus Kommentaren“-Tasks NICHT nur dem mitgelieferten Grep vertrauen. Zusätzlich breit greppen: `\bR[0-9]+(-FIX)?\b|\bE[0-9]\b|\bA[0-9]\b|\bD[0-9]\b|Stop-and-Ask|report §|architect-decision`, dann manuell die echten Decision-Codes von false positives (`TEXT_INLINE`, HTTP-Codes wie 503/401, `SHA-256`, Array-Literale `[[`) trennen. `ADR 0001` (plain) ist ein echtes Repo-Dokument und bleibt. Memory-Links `[[name]]` im Source ebenfalls als Task-Referenzen behandeln und entfernen.

Außerdem: zsh `for`-Loop mit `$SCOPE`-Var über mehrere `grep -rInE` gab 0 Treffer (Var-Expansion/Heredoc-Mangling zwischen bash-Calls) — Scope-Pfade direkt inline in den grep schreiben, nicht über Shell-Variable.
