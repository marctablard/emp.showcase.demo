---
name: project-show323-reimplementation
description: SHOW-323 wird im showcase reimplementiert (Strategie F, hybrid-TDD) — emporix-frontend dient als Spec-by-Example-Referenz, nicht als Code-Quelle
metadata:
  type: project
---

SHOW-323 (CMS-Adapter-Framework + Per-Site-Theming + Webhook + Preview-Route) wird im showcase-Repo neu implementiert. Strategie F (Reimplementierung mit hybrid-TDD), nicht E (Squash-Port) und nicht D (180-Commit-Rebase). Quell-Repo `emporix-frontend` ist verbindliche [[feedback-source-repo-as-spec-by-example]] — Lese-Referenz, nicht Code-Quelle. Plan-Datei: `.claude/SHOW-323-port-plan-v3.md`. Vorgänger-Pläne v1 (Strategie D) und v2 (Strategie E) sind archiviert.

**Why:** User-Direktive 2026-05-26 nach Strategie-Diskussion: Ziel ist Feature-Parität im showcase mit voller TDD-Disziplin und Testabdeckung. Code-Port-Workarounds (Squash gegen Memory-Regel `feedback_no_task_internals_in_code`, TDD-Authentizitäts-Verlust) sind nicht akzeptabel. KI-Agententeam macht Reimplementierung wirtschaftlich (1–2 Tage Größenordnung, siehe [[feedback-ki-team-estimation]]).

**How to apply:**
- Slice-Sequenz fix (11 Phasen, gemäß `.claude/SHOW-323-slice-*.md` als Story-Specs):
  - Vor-Slice 0 (Setup-Files: jest config + mocks + .env.template-Doku — als reiner File-Lift erlaubt, keine Logik)
  - Slice 1–9 (Reimplementation mit hybrid-TDD)
  - Nach-Slice 10 (Production-Smoke `next build && next start` + CI-Hook)
- Pro Slice: Architect plant gegen showcase-Bestand + Quell-Referenz → testing-engineer schreibt failing Akzeptanz-Tests → frontend-developer macht grün → Cross-Review beidseitig → PR `head=feature/SHOW-323` / `base=feature/SHOW-323-target` auf Gitea.
- Quell-Referenzen (immer in Sub-Agent-Briefs nennen):
  - **Vorlage-Worktree** (verbindliche Referenz für diesen Task): `/Users/mhammer/Projekte/emporix/emporix-frontend.git/worktrees/SHOW-323`
  - **Ziel-Scope-Definition**: `<Vorlage-Worktree>/SHOW-323-summary.md` — beschreibt was das fertige Feature umfasst. "Task soweit bringen wie in der Vorlage" = diesen Soll-Stand erreichen.
  - Quell-Bare: `/Users/mhammer/Projekte/emporix/emporix-frontend.git`
  - Quell-Ref im showcase-bare: `imported/SHOW-323` @ `744bdb8`
- **Soll-Scope laut Summary** (Stand der Vorlage): 22 CMS-Komponenten, 3 Adapter (Storyblok/Mock/Null), ~1485 Tests, 8 Architektur-Bausteine: Plugin-SPI · Component-Map/Schema · Server-First+Islands · Layout-Konzept (CMSLayout + content-slot, bringt 20→22 Komponenten) · Cache+Webhook · Per-Site-Theming · Preview-Route · Composite-Fallback. Verbleibend ab Phase C: Adapter-Pipeline (Storyblok+Mock-Adapter), Layout, Theming, Webhook, Preview, Composite.
- **FU-003 (Tailwind-v4 utility-layer vs. button/a)**: **NICHT Teil von EMP-2/SHOW-323.** Wird als eigenes Ticket separat beauftragt (per User-Wake aa3509c5 vom 2026-05-31: „FU-003 ist ein eigener Task. Der muss gesondert beauftragt werden. (Noch nicht bestätigt) Bitte deshalb nur die Phase A-G fertigstellen"). Quelle: `SHOW-323-summary.md` §12, `.claude/follow-up-stories.md` FU-003. Weitere Folge-Stories ebenfalls außerhalb dieses Umbrellas: FU-001 (data-testid-Helper), FU-002 (E2E-Fixture-Page), FU-004 (HMAC-Preview-Token-Verify, security medium).
- ADRs aus Quell-Repo (`docs/adr/0001-cms-adapters-own-their-render-path.md`, `docs/cms-framework.md`) werden früh übernommen, damit Architektur-Entscheidungen dokumentiert sind, bevor Slice 1 implementiert wird.
- Showcase-Default-Branch ist `develop` (`cbdd1dbe`); `master` (`5146e56a`) ist Legacy, 1343 Commits divergent, wird nicht angefasst.
- `feature/SHOW-323-target` zweigt von `develop` ab; `feature/SHOW-323` ist Arbeits-Branch.
- Remote-Disziplin: [[feedback-port-phase-remote-isolation]] — Gitea ist Primär, Origin gesperrt bis Letzt-Merge + User-Freigabe.
- ENV-Token-Rename `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` → `STORYBLOK_ACCESS_TOKEN`: Breaking für aktive Deployments. Vor-Slice 0 nur `.env.template`-Doku; echte Code-Umstellung in Slice 1.
- **Adapter-Naming-Abweichung von Vorlage (User-Entscheidung 2026-05-27)**: showcase behält `LocalJsonCmsAdapter` (`CmsAdapter:local`), die Vorlage nennt es `MockCmsAdapter` (`CmsAdapter:mock`). Funktion identisch (JSON-Fixtures), Name bleibt `local` — NICHT umbenennen. Slice 7 ("Mock-CMS") darf keinen zweiten Mock-Adapter einführen oder `local` umbenennen; was Slice 7 inhaltlich noch beiträgt (z. B. default-content fixtures) ist beim Slice-7-Start gegen die Vorlage zu klären. Doku (ADR/cms-framework) dokumentiert `LocalJsonCmsAdapter`, nicht Mock.
- **Reihenfolge der Phasen ist flexibel** (User 2026-05-27: "Reihenfolge egal, solange am Ende alles funktioniert") — nur die harten Constraints aus Plan v3 Sektion 5 beachten (z. B. Renderer braucht Co-Location). Ziel ist Feature-Parität mit `SHOW-323-summary.md`.

Slice-Status laufend in `SHOW-323-port-plan-v3.md` Sektion 10 pflegen.

**Stand 2026-05-31 (EMP-2 Wake):** Phasen A–G sind code-seitig im `feature/SHOW-323`-Branch (Commits siehe Plan v3 §5). Letzte offene Punkte für EMP-2-Abschluss: (1) Gitea-PRs der Phasen D–G gegen `feature/SHOW-323-target` finalisieren + per Phase mergen, (2) Aggregat-PR `feature/SHOW-323-target` → `develop` (Gitea, anschließend Origin nach User-Freigabe), (3) Cleanup `imported/SHOW-323`. FU-001/FU-002/FU-003/FU-004 sind eigene Tickets und werden nach Letzt-Merge separat beauftragt.
