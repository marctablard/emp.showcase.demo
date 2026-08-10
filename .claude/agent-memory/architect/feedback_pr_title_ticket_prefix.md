---
name: feedback-pr-title-ticket-prefix
description: PR-Titel beginnen mit der Ticket-Nummer (z. B. "SHOW-323: ..."). Gilt NUR für den PR-Titel — NICHT für Commits, Code, Kommentare, Test-Titel.
metadata:
  type: feedback
---

PR-Titel (Gitea/GitHub) beginnen immer mit der Ticket-Nummer als Prefix, gefolgt von `: ` und der generischen Beschreibung.

Beispiel: `SHOW-323: CMS component co-location — remaining 14 default components`

**Why:** User-Direktive 2026-05-27. Sobald an mehreren Tickets parallel gearbeitet wird, macht die Ticket-Nr im PR-Titel das Auffinden des richtigen PR in der Gitea/GitHub-Liste leicht.

**How to apply:**
- Beim PR-Erstellen via `tea pr create --title "SHOW-XXX: <beschreibung>"`.
- Ticket-Nr ist in **PR-Titel, PR-Body UND Commit-Messages** erlaubt (siehe [[feedback-no-task-internals-in-code]] Klasse 1). Verboten bleibt sie nur in Code/Kommentar/Test-Titel.
- **Slice/Phase-Codes** gehören NICHT in den PR-Titel/Body (auch nicht in Commits) — die sind interne Agent↔User-Strukturierung. PR-Beschreibung also: Ticket-Nr-Prefix + fachliche Beschreibung, aber keine "Slice 3 / Phase B"-Bezeichnungen.
- Bei offenen PRs ohne Prefix: nachträglich via `tea pr edit <nr> --title "SHOW-XXX: ..."` umbenennen.
