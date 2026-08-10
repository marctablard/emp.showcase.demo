---
name: no-task-internals-in-code
description: Ticket-Nr (SHOW-323) verboten in Code/Kommentar/Test-Titel, aber erlaubt in Commit-Messages + PRs. Slice/Phase/DR/Decision-Codes verboten ÜBERALL öffentlich (auch Commits/PRs) — reine Agent↔User-Strukturierung.
metadata:
  type: feedback
---

Zwei verschiedene Klassen von Task-Internals mit unterschiedlichen Regeln (User-Präzisierung 2026-05-27):

## Klasse 1 — Ticket-Nummer (`SHOW-323` o. ä.)

| Ort | Erlaubt? |
|---|---|
| Code (inkl. JSDoc/Zeilen-Kommentare) | ❌ verboten |
| Test-Titel (`describe`/`it`) | ❌ verboten |
| Commit-Messages | ✅ **erlaubt** |
| PR-Titel + PR-Body | ✅ erlaubt (PR-Titel-Prefix sogar Pflicht, siehe [[feedback-pr-title-ticket-prefix]]) |

**Why Code-Verbot:** Code lebt im Repo unabhängig vom Ticket-System; eine `SHOW-323`-Referenz im Code ist toter Verweis sobald das Ticket geschlossen ist. **Why Commit/PR erlaubt:** Commits + PRs sind die Verbindung zwischen Code-Änderung und Ticket-Tracking — dort ist die Ticket-Nr legitime Nachvollziehbarkeit.

## Klasse 2 — Slice/Phase + alle Decision-Codes

Verbotene Muster **überall öffentlich** (Code, Kommentar, Test-Titel, **Commit-Messages, PR-Titel, PR-Body**): `Slice <n>`, `Phase <A-G>`, `RE-CUT`, `walking-skeleton` (als Task-Begriff), `DR<n>`, `R<n>`, `Decision <n>`, `A<n>` (Architekt-Decision-Codes), `E<n>`, `SA<n>`, `TH<n>`, `LE<n>`, `TB<n>`, `D<n>` (D2/D4), `Tier <n>`, `Architekt-Entscheidung(en)`, `Pattern A`, `PR #<n>`, `.claude/`-Verweise.

**Why:** User-Direktive 2026-05-27: *"Slices und Phasen gehören nirgends öffentlich kommuniziert, da diese nur zur Unterteilung eines Tasks dienen. Die Unterteilung ist ein Ding zwischen mir und euch."* Die Slice/Phase-Struktur ist interne Agent↔User-Organisation, kein öffentliches Artefakt — auch nicht in Commit-Messages oder PR-Beschreibungen.

## Erlaubt

Verweis auf **`ADR 0001`** (echtes committetes Repo-Dokument unter `docs/adr/`). Technische Begründungen (WARUM) bleiben — als selbst-erklärende Aussage, ohne Task-Codes (z. B. `// DR1: restore breadcrumb` → `// restore breadcrumb`).

## How to apply — verbindlich an zwei Stellen

1. **Jeder Sub-Agent-Brief**: *"KEINE Ticket-Nr in Code/Kommentar/Test-Titel (in Commit-Message ok). KEINE Slice/Phase/Tier/Decision-Codes irgendwo — auch nicht in Commit-Messages. Begründungen als selbst-erklärende technische Aussage. Plain `ADR 0001` ok."*
2. **Cross-Review-Gate** (Architect + testing-engineer), zwei getrennte Greps:
   - Über **geänderte Code-Files** (`git diff`): `SHOW-323|Slice [0-9]|Phase [A-G]|walking.?skeleton|RE-CUT|\bDR[0-9]|Decision [0-9]|Pattern [A-Z]\b|Tier [0-9]|D[0-9]|\.claude/` → muss leer sein (außer plain `ADR 0001`).
   - Über **Commit-Messages** des Slice-Stacks (`git log --format=%B target..HEAD`): `Slice [0-9]|Phase [A-G]|walking.?skeleton|RE-CUT|Tier [0-9]|Decision [0-9]|Pattern [A-Z]\b` → muss leer sein. `SHOW-323` hier NICHT prüfen (erlaubt).

Plan-Files (`.claude/`) dürfen alle Codes intern nutzen — nur beim Übertragen nach Code/Commit/PR gestrippt (Slice/Phase) bzw. Ticket-Nr aus Code raus.
