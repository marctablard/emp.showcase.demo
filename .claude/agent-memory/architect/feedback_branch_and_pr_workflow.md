---
name: feedback-branch-and-pr-workflow
description: SHOW-323 Branch- und PR-Konvention. Es gibt EINEN Arbeits-Branch (`feature/SHOW-323`) und EINEN Story-Akkumulations-Branch (`feature/SHOW-323-target`). PRs haben IMMER head=`feature/SHOW-323`, base=`feature/SHOW-323-target`. Keine Slice-Branches. Master wird NIE direkt aus Story-Branches gemerged.
metadata:
  type: feedback
---

**Regel**: Für SHOW-323 gilt eine harte 3-Branch-Konvention:

| Branch | Rolle |
|---|---|
| `master` | Production. Wird durch SHOW-323-Slices NIE direkt verändert. |
| `feature/SHOW-323-target` | **Story-Akkumulations-Branch**. Sammelt nach Slice-Merge die fertigen Commits. Wird am Story-Ende per finalem PR nach `master` gemerged. |
| `feature/SHOW-323` | **Arbeits-Branch**. Hier wird in JEDEM Slice gearbeitet — Engineer + testing-engineer committen darauf. Per-Slice-PR geht von hier gegen `feature/SHOW-323-target`. Nach Merge wird `feature/SHOW-323` für den nächsten Slice weiterverwendet (NICHT gelöscht, NICHT zurückgesetzt). |

**Why:** Zwei systematische Fehler in der SHOW-323-Story:

1. **Falscher PR-Target (ab Slice 2)**: PRs wurden gegen `master` erstellt statt `feature/SHOW-323-target`. Resultat: Slice 2 + 3 + 4 landeten direkt in `gitea/master`, der zur "Story-Saukloake" wurde — verschmutzt mit Code, der hätte erst nach Final-Review nach master gemerged werden sollen. Korrektur 2026-05-20: `gitea/master` per Force-Push auf `origin/master` zurückgerollt (mit `--force-with-lease`), alle Story-Commits vorher in `feature/SHOW-323-target` gesichert.
2. **Slice-Branches (ab Slice 4)**: Slice 4 und Slice 5 wurden in eigenen Branches gebaut (`feature/SHOW-323-slice-4`, `feature/SHOW-323-slice-5`). User-Direktive war explizit "es gibt EINEN Arbeits-Branch `feature/SHOW-323`", was ich übersehen habe. Korrektur 2026-05-20: Slice-Branches gelöscht, alle Slice-Commits in `feature/SHOW-323` zusammengeführt.

**How to apply:**

Bei jedem Slice-Start (Pre-Slice-Disziplin gemäß [[feedback_quality_gates_per_slice]]):

1. **Branch-Check**: `git branch --show-current` → muss `feature/SHOW-323` sein. Wenn nicht: `git checkout feature/SHOW-323`. **KEIN `git checkout -b feature/SHOW-323-slice-N gitea/master`**.

2. **Sync mit gitea-Remote**: `git pull --ff-only gitea feature/SHOW-323` (vor jedem Slice-Start). Wenn fast-forward fehlschlägt: nicht weiterarbeiten, klären.

3. **PR-Erstellung pro Slice** (am Slice-Ende):

   ```bash
   tea pulls create \
     --repo Emporix/emporix-frontend \
     --head feature/SHOW-323 \
     --base feature/SHOW-323-target \
     --title "SHOW-323 Slice N — <topic>" \
     --description "..."
   ```

   **NIE `--base master`**. NIE `--head feature/SHOW-323-slice-N`.

4. **Push-Befehl**: `git push gitea feature/SHOW-323` (NICHT `feature/SHOW-323-slice-N`).

5. **Pre-PR-Verifikation**: vor `tea pulls create` einmal `git log --oneline gitea/feature/SHOW-323-target..gitea/feature/SHOW-323 | wc -l` ausgeben — das muss == Anzahl der Slice-N-Commits sein. Wenn deutlich höher: dann ist target nicht aktualisiert (Vorgänger-Slice nicht gemerged) — Stop-and-Ask.

6. **NIE gegen `origin` pushen** ([[feedback_push_origin_forbidden]] — Push-Verbot, separat verankert). Origin ist read-only mirror, nur fetchen.

**Sub-Agent-Briefings**: jeder Sub-Agent-Spawn (frontend-developer, testing-engineer) bekommt im Briefing **explizit**:

> *"Branch: `feature/SHOW-323`. NIE einen separaten Slice-Branch erstellen. Commits gehen auf `feature/SHOW-323`. PRs werden vom Architect erstellt mit head=`feature/SHOW-323`, base=`feature/SHOW-323-target`."*

**Story-End-Schritt**: nach dem letzten Slice (= Slice 7 in der aktuellen Roadmap):
- Finaler PR `feature/SHOW-323-target` → `master`
- User reviewt + mergt
- `feature/SHOW-323` + `feature/SHOW-323-target` können danach gelöscht werden
