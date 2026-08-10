---
name: branch-wide-grep-for-pre-existing-findings
description: HARTE Regel — Pre-Existing-Findings (Memory-Regel-Verstöße, die schon vor dem aktuellen Slice im Branch lagen) MÜSSEN branch-weit gegrept werden, nicht nur über die im aktuellen Slice geänderten Files.
metadata:
  type: feedback
---

**Regel**: Wenn beim Cross-Review oder Architecture-Review ein Pre-Existing-Verstoß gegen eine Memory-Regel auftaucht (z. B. Task-Internals in Code), **muss der Grep branch-weit** über alle Source/Doc/Config-Files laufen — NICHT nur über die im aktuellen Slice geänderten Files.

**Why:** Cross-Review von Commit `13bebba` (Per-Request Preview): ich (Architect) habe nur über die 12 Developer-geänderten Files gegrept und 3 `SHOW-323`-Treffer gemeldet. Der frontend-developer hat beim Cleanup-Auftrag dann branch-weit gegrept und **14 weitere echte Treffer** in 12 anderen Files gefunden, die ich übersehen hatte. Das hat eine zweite Cleanup-Runde nötig gemacht.

User-Erwartung (etabliert bei PR #10): *"Bitte geh den kompletten branch nochmal durch und entferne solche dinge überall!"* — heißt: Branch-Compliance, nicht nur Slice-Compliance.

**How to apply — verbindlich, immer:**

1. **Im Cross-Review eines Slices**: wenn EINE Memory-Regel-Verletzung (Task-Internals, ENV-Pattern, etc.) im aktuellen Diff sichtbar wird, sofort einen **branch-weiten Grep** als Vorbedingung für das Approve auslösen:
   ```bash
   git grep -nE '<pattern>' -- 'src/**' 'docs/**' '*.json' '*.config.*' '*.css' '.env*'
   ```
   Ausnehmen: Test-Files (eigene Grep-Regel) und `package-lock.json` (false-positives durch Hashes).

2. **Im Architecture-Review-Output**: alle Treffer auflisten — Slice-bezogene UND pre-existing. Pre-existing ist KEIN Grund, sie verschweigen oder als "separate Ticket"-Punkt zu deklarieren. User-Regel: Branch-Compliance > Slice-Compliance.

3. **Im Cleanup-Brief an den Sub-Agent**: nicht eine Liste konkreter Stellen vorgeben, sondern den **branch-weiten Grep selbst ausführen** und alle echten Treffer adressieren. False-Positives (z. B. `\bR[0-9]` in `package-lock.json`-Hashes) explizit ausnehmen, nicht stillschweigend übergehen — Liste sie auf, dann werden sie nachvollziehbar gefiltert.

4. **In Plan-Output Sektion 8 (Akzeptanzkriterien)**: bei einem Slice mit potenziellem Memory-Regel-Touch gehört ein Akzeptanzkriterium dazu wie: *"Branch-weiter Grep `<pattern>` ist leer (außer dokumentierte Ausnahmen wie Drift-Guard-Test-Literale)."*

Gilt analog für andere Branch-weite Disziplinen, nicht nur Task-Internals:
- ENV-driven per-request-state (`feedback_no_global_env_for_per_request_state.md`)
- `'use client'`-Audit (`feedback_use_client_audit.md`)
- Skip-Layer-Imports (Browser importiert `@/platform/server` o.ä.)

Sobald eine Verletzung im Slice gefunden wird, ist die Hypothese: "ähnliche Verletzungen liegen anderswo im Branch". Verifiziere durch Branch-Grep, nicht durch Annahme.
