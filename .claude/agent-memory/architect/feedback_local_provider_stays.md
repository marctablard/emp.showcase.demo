---
name: feedback-local-provider-stays
description: Provider-ID `local` bleibt im showcase — KEIN Rename auf `mock`, obwohl das Quell-Repo emporix-frontend `mock` nutzt. Plan v3 §5 und Slice 5 File-Inventory haben hier eine Drift zur User-Entscheidung.
metadata:
  type: feedback
---

Im showcase bleibt der nicht-Storyblok Provider als `local` benannt — `LocalJsonCmsAdapter`, `CMS_PROVIDER_IDS = ['storyblok', 'local', 'none']`, `docs/local-cms.md`. **Kein Rename auf `mock`**, auch wenn das Quell-Repo `emporix-frontend` (Branch `gitea/feature/SHOW-323-target`) auf `mock` umgezogen ist.

**Why:** User-Entscheidung früher bestätigt (vor 2026-05-29 Architect-Self-Reminder). Begründung war pragmatisch: ADR 0001 + ADR 0002 + `docs/local-cms.md` + alle Memory- und Test-Files referenzieren `local`; ein Rename wäre rein-kosmetisch und würde mehrere Stellen anfassen, die nicht zur Slice-Funktion gehören. Spec-by-Example heißt **nicht** Naming-1:1 übernehmen.

**How to apply:**
- Slice 5 (Phase D) File-Inventory: alle `mock/cms/impl/MockCmsAdapter*`-Pfade aus Plan v3 mental ersetzen durch `local/cms/impl/LocalJsonCmsAdapter*`.
- Plan v3 §5 sagt "`docs/mock-cms.md` kommt mit Phase D" → wird **nicht** angelegt. Stattdessen wird `docs/local-cms.md` für Layout/Banner aktualisiert (war eh in Phase C Plan-Liste).
- Phase D Plan-Entwurf darf das Quell-Repo-Naming `mock` als Drift behandeln und übersetzen, nicht übernehmen.
- Sub-Agent-Briefs müssen den Provider-Namen explizit nennen, damit Quell-Repo-Reads (`emporix-frontend` als Spec-by-Example) nicht in den Patch übernommen werden.
- Bei Review: jeder `mock`-Treffer in neu-erzeugtem Code im showcase ist ein Finding, außer es geht um Jest-Mocks oder TypeScript-Mock-Funktionen — also lib-bezogen, nicht Provider-bezogen.

**Architectural rationale (für Sub-Agents):** Drift im Naming zwischen Spec-Quelle und Ziel-Codebase ist OK, solange die **Architektur-Maxime** (Plugin = nur Adapter, ADR 0001) übertragen wird. Adapter-Naming ist Lokal-Konvention, nicht Architektur.
