---
name: feedback-source-repo-as-spec-by-example
description: Wenn ein Quell-Repo mit fertiger Feature-Implementation existiert, ist es während der Reimplementierung verbindliche Spec-by-Example-Referenz für Architect und Sub-Agents
metadata:
  type: feedback
---

Bei Reimplementierungen, denen ein Quell-Repo mit bereits fertiger Feature-Implementation gegenüber steht (z. B. SHOW-323: emporix-frontend → showcase), ist das Quell-Repo verbindliche **Spec-by-Example-Referenz** während der gesamten Reimpl-Phase. Es wird *nicht* kopiert (Memory-Regel `feedback_do_it_right_over_quick_fix`), aber pro Slice aktiv gelesen — als Architektur-Spec, Edge-Case-Quelle, Test-Vorlage.

**Why:** User-Direktive 2026-05-26 zur SHOW-323-Reimplementation: "Wir sollten immer das andere Repo als Vorlage nutzen." Die Reimplementierung im neuen Repo soll Feature-Parität, Testabdeckung und TDD-Disziplin liefern — aber die Edge-Cases und Bug-Fixes, die im Quell-Repo erarbeitet wurden, dürfen nicht verloren gehen.

**How to apply:**
- Jeder Architect-Plan pro Slice **muss** den Pfad zur Quell-Implementation und zu den Quell-Tests namentlich benennen.
- Sub-Agent-Briefs (frontend-developer, testing-engineer) erhalten Quell-Pfade als Pflicht-Lesematerial:
  - Quell-Bare: `/Users/mhammer/Projekte/emporix/emporix-frontend.git`
  - Quell-Worktree (für direkten File-Lookup): `/Users/mhammer/Projekte/emporix/emporix-frontend.git/worktrees/SHOW-323`
  - Quell-Ref im showcase-bare (für `git show`-Lookups): `imported/SHOW-323` (@ `744bdb8`)
- testing-engineer übernimmt die **Test-Strategie** aus Quell-Tests, schreibt aber neue Tests gegen showcase-Kontext (Drift-Pins explizit nachfragen, ob übernehmen).
- frontend-developer liest die **Quell-Implementation als Lösungs-Referenz** (Naming, DI-Pattern, Edge-Cases), schreibt aber frischen Code gegen showcase-Bestand.
- Cross-Review prüft auch **Feature-Parität gegen Quell-Verhalten**, nicht nur showcase-internal Konsistenz.
- Während der gesamten Reimpl-Phase bleibt `imported/SHOW-323`-Ref im showcase-bare bestehen. Cleanup erst nach Letzt-Slice.
