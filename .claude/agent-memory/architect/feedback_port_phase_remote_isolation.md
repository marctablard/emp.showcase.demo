---
name: feedback-port-phase-remote-isolation
description: Während dediziertem Port (z. B. SHOW-323) ist Gitea der Primär-Remote; Origin (GitHub) ist gesperrt bis nach Letzt-Slice-Merge UND expliziter User-Freigabe
metadata:
  type: feedback
---

Bei einem dedizierten Port eines Feature-Branches (Multi-Slice, mehrere PRs nacheinander) ist während der gesamten Port-Phase nur der **Sekundär-Remote** (z. B. Gitea) für Pushes und PRs zu verwenden. Der **Primär-Remote** (z. B. GitHub `origin`) ist tabu — kein Push, kein PR — bis (a) der letzte Slice auf den Akkumulations-Branch (`feature/SHOW-323-target`) gemerged ist UND (b) der User explizit grünes Licht für den Origin-Push gibt.

**Why:** User-Direktive zum SHOW-323-Port (2026-05-26): Slice-Reviews finden auf Gitea statt, Origin (GitHub) ist erst nach Letzt-Merge mit expliziter Freigabe dran. Vermeidet (i) versehentliche Sichtbarkeit unfertiger Slice-Stände im offiziellen GitHub-Repo, (ii) Disruption durch parallele Code-Reviews an zwei Stellen, (iii) Drift-Probleme zwischen Gitea- und GitHub-State während des Ports.

**How to apply:**
- Pro Slice: `git push gitea feature/SHOW-323`, nicht `git push origin …`.
- PRs eröffnen via Gitea-UI/API, nicht via `gh pr create` (gh greift origin/GitHub).
- Nach Letzt-Slice (Nach-Slice 10) gemerged: warten auf User-OK. Erst danach **einmaliger** `git push origin feature/SHOW-323-target` + einziger Aggregat-PR auf GitHub gegen `develop`.
- Wenn ein Tool/Skill defaultmäßig origin nutzt (`gh`, `git push` ohne Remote), explizit das andere Remote angeben.
- Gilt analog für künftige dedizierte Ports / Migrations-Tasks mit Multi-Remote-Setup. Bei normalem Workflow (Single-Remote) nicht relevant.
