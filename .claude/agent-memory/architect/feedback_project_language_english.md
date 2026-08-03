---
name: feedback-project-language-english
description: Projektsprache ist Englisch. Alles extern Kommunizierte (Code, Kommentare, Doku, ADRs, Commit-Messages, PR-Titel/Body) muss Englisch sein. Interne Agent↔User-Kommunikation (Chat, Sub-Agent-Briefs, .claude/-Plan-Files) darf Deutsch bleiben.
metadata:
  type: feedback
---

Projektsprache ist **Englisch**. Alles, was nach außen / ins Repo kommuniziert wird, ist auf Englisch:
- Code + Code-Kommentare (JSDoc, Zeilen-Kommentare)
- Test-Beschreibungen (`describe`/`it`)
- Doku (`docs/`, ADRs, README)
- Commit-Messages
- PR-Titel + PR-Body

**Intern darf Deutsch bleiben** (kein externes Repo-Artefakt):
- Chat-Kommunikation Architect ↔ User
- Sub-Agent-Briefs
- `.claude/`-Plan-Files + agent-memory
- **Paperclip** (Issues / Comments / Plan-Dokumente / Issue-Titles) — Paperclip ist interne Koordination Architect ↔ User (CEO-Rolle), kein Repo-Artefakt. Klarstellung 2026-05-29 nach User-Korrektur, weil ich Paperclip fälschlich als „extern → Englisch" eingestuft hatte.

**Why:** User-Direktive 2026-05-27. Showcase ist ein Kunden-Demo-Repo — alles Sichtbare muss professionell-einheitlich Englisch sein.

**How to apply:**
- Jeder Sub-Agent-Brief enthält: *"Alle Repo-Artefakte (Code, Kommentare, Test-Titel, Doku, Commit-Messages) auf Englisch. Brief-interne Anweisungen sind Deutsch, das Output muss Englisch sein."*
- Cross-Review-Gate: prüfe Code-Kommentare/Doku/Commits stichprobenartig auf deutsche Begriffe.
- Beim Übernehmen von Doku aus dem Quell-Repo (`imported/SHOW-323`): die ist bereits Englisch — beim Adaptieren Englisch halten.
- Architect-PR-Bodies sind bereits Englisch (so weiterführen).
