---
name: feedback-quality-gates-per-slice
description: Verbindliche Quality Gates pro Slice (10 Stück), Pro-Slice-Ablauf, Stop-and-Ask-Lagen. User-Vereinbarung "durchziehen ohne User-CR" hängt von der konsequenten Einhaltung dieser Gates ab.
metadata:
  type: feedback
---

User-Vereinbarung (SHOW-323, Slice 4 onwards): Slices werden ohne User-CR pro Slice durchgezogen. User macht ggf. Final-Acceptance am Ende. **Bedingung**: die 10 Quality Gates unten werden konsequent eingehalten. Wenn ich (Architect) auch nur ein Gate übergehe, ist der Trust-Vertrag gebrochen.

## Die 10 Quality Gates pro Slice (alle müssen grün sein vor Push)

| # | Gate | Wie verifiziert | Wer prüft |
|---|---|---|---|
| 1 | `npm run jest` grün, Test-Count steigt oder bleibt gleich | Bash-Output gegen letzte Slice-Baseline (in Memory persistieren!) | Architect, eigenständig |
| 2 | `npm run build` grün | Bash-Exit-Code | Architect, eigenständig |
| 3 | `npm run verify:client-chunks` grün | Bash-Output | Architect, eigenständig |
| 4 | `npm run check-translations` + `npm run lint` grün | Bash-Output | Architect, eigenständig |
| 5 | **Test-Vertrag-Drift-Check**: `git diff <baseline>..HEAD -- '**/*.test.*'` enthält keine `expect()`-Lockerung | Diff lesen, jede `-expect`-Zeile gegen `+expect`-Replacement prüfen | Architect + testing-engineer doppelt |
| 6 | **Browser-Smoke** via playwright-cli auf relevanten Routes: 0 Errors, 0 unerwartete Warnings | Snapshot + Console-Log | testing-engineer (NICHT Architect, NICHT Engineer-Self) |
| 7 | **`'use client'`-Audit** pro neuer Datei: Checkliste (Hooks / Browser-API / Event-Handler / Subgraph-Trigger) | Pre-Audit pro Datei | testing-engineer im Cross-Review |
| 8 | **Verhaltens-1:1-Pinning** für Pattern-A-Inseln: fireEvent-Tests, DOM-Mutation-Verhalten verifiziert | Test-Code-Review | testing-engineer |
| 9 | **Naming-/Schichten-Audit**: Co-Location, Suffix-Convention, kein Schichten-Bruch | Diff-Audit | Architect |
| 10 | **Cross-Review-Loop bis 0 Findings**: testing-engineer + Architect parallel, Iterationen bis beide 0 zurückgeben | Reviewer-Verdict | beide |

## Pro-Slice-Ablauf (ohne User-CR)

1. **Architect plant Slice** (Plan-File in `.claude/SHOW-323-slice-N.md`)
2. **testing-engineer** schreibt Test-Strategie + Akzeptanz-Tests
3. **frontend-developer** baut, Quality-Gates 1-4 grün pro Commit
4. **Iteration 1 Cross-Review** (parallel):
   - testing-engineer: Test-Layer-Review + Browser-Smoke schon hier (NICHT erst in Iteration 2/3 — Iteration-Wirtschaftlichkeits-Lehre aus Slice 3)
   - Architect: Architektur-Audit + Test-Vertrag-Drift-Check + Quality-Gates 1-4 verifizieren
5. **Fix-Loop bis beide Reviewer 0 zurückgeben** (siehe `feedback_cross_review_discipline.md`)
6. **Architect pusht zu `gitea`** + erstellt PR via `tea`
7. **Architect mergt PR** via `tea pulls merge` (ohne User-CR)
8. **Architect aktualisiert Plan-File** (Slice als done, neue Baseline-Zahlen, Lessons learned)
9. nächster Slice

## Stop-and-Ask-Lagen (wann User doch gefragt wird)

Nur in diesen Fällen — sonst stille Arbeit:

- **Architekturelle Entscheidung**, die ich nicht alleine treffen kann:
  - Neue ENV-Variable mit Public/Server-Trennung
  - Layout-Schema-Form (z. B. Slice 5+6 Layout-Konzept)
  - Adapter-SPI-Erweiterung
  - Cross-Cutting-Concerns (Cache-Strategie, Auth-Flow)
- **Cross-Reviewer findet zwei Iterationen hintereinander den gleichen Fund** (Konvergenz-Problem)
- **Reviewer widersprechen sich** (Test-Vertrag vs. Architektur, oder Performance vs. Lesbarkeit)
- **Slice-Scope sprengt Schätzung um Faktor >1.5x** (z. B. 30 → 50+ Files)
- **Bug-Klasse außerhalb meines Audit-Patterns**: wenn ich beim Audit auf etwas stoße, das nicht in den Gates oder Memory-Pattern abgedeckt ist und unsicher bin — frag den User, statt blind durchzuwinken

## Verbindliche Pre-Slice-Disziplin

Vor jedem Slice-Start (Architect-Pflicht):
1. **MEMORY.md vollständig lesen** (alle 3 Memory-Files)
2. **`.claude/SHOW-323-plan.md` lesen** (insbesondere Decision Log §17.5 + Quality-Gates-Sektion)
3. **`.claude/SHOW-323-slice-<N-1>.md` Lessons-Learned-Eintrag lesen** (was im vorherigen Slice schiefging)
4. **Test-Count + Suite-Count-Baseline notieren** (für Drift-Check)
5. **Plan-File für aktuellen Slice schreiben** mit konkretem File-Inventar

Vor jedem Sub-Agent-Spawn:
- Briefing referenziert die Memory-Einträge explizit: `[[feedback-cross-review-discipline]]`, `[[feedback-use-client-audit]]`, `[[feedback-quality-gates-per-slice]]`
- Briefing enthält die spezifischen Quality-Gates, die für den Spawn relevant sind (z. B. testing-engineer-Briefing → Gates 5/6/7/8/10)
- Briefing fordert Verdict-Format `PASS` (0 Findings) oder `FIX-AND-RETRY`, keine Zwischenkategorien

## Context-Erschöpfungs-Plan

Wenn ich mit erschöpftem Context konfrontiert bin (>70%):
1. **Kein neuer Sub-Agent-Spawn** ohne vorherige Persistierung der aktuellen Slice-Position im Plan-File
2. **Lessons-Learned-Eintrag** im aktuellen Slice-Plan-File schreiben, bevor Context kippt
3. **MEMORY.md-Index aktuell halten** — er wird beim Continuation-Start automatisch geladen und steuert mich

User-spezifische Sorge (warum diese Disziplin): User hat in der Vergangenheit erlebt, dass "Tests grün" gemeldet wurde, während `jest` gar nicht installiert war. Diese Quality-Gates-Liste + die eigenständige Architect-Bash-Verifikation sind das Gegen-Pattern.

## Hard No

- "PASS mit Caveat" / "Approve with fix blockers" / "minor reicht für Push" → siehe `feedback_cross_review_discipline.md`
- Engineer-Selbstbericht "alle Gates grün" für bare Münze nehmen → Architect verifiziert eigenständig per Bash
- Browser-Smoke skippen oder durch Curl-Smoke ersetzen → playwright-cli ist die einzige akzeptierte Smoke-Methode (Curl wird vom Middleware-Healthcheck abgefangen + fängt keine Console-Errors)
- Tests anpassen, um sie grün zu halten (statt den Bug zu fixen) → Test-Vertrag-Drift-Check fängt das
