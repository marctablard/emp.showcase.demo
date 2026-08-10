---
name: feedback-show323-lintstaged-drops-unstaged-deletions
description: SHOW-323 — lint-staged pre-commit hook stashes UNSTAGED changes; an `rm <flat>.tsx` that isn't `git add`-ed gets stashed away and never committed, leaving the deleted file back in HEAD.
metadata:
  type: feedback
---

Beim CMS-Co-Location-Migrieren: pro Komponente `rm src/components/cms/<name>.tsx` (flat), dann `git add -A src/components/cms/<name>/ component-map.ts component-schema.ts` — die **Löschung der flachen Datei war NICHT in der `git add`-Pfadliste**. lint-staged stasht alle unstaged Changes vor dem Commit, popt sie danach zurück → die Löschung landete nie im Commit, die flache Datei blieb in HEAD (auf Disk gelöscht, im Tree present). 12 von 14 Komponenten betroffen; build/jest blieben grün (Directory-Resolution bevorzugt `index.ts`, aber tsc kann auf `<name>.tsx` statt `<name>/index.ts` auflösen → dual-resolution-Risiko).

**Why:** `git add -A <specific-paths>` staged nur die genannten Pfade. Die `rm`-Löschung eines NICHT-genannten Pfads bleibt unstaged → lint-staged-Stash schluckt sie.

**How to apply:** Bei Migrate-and-Delete entweder (a) `git rm src/components/cms/<name>.tsx` explizit (staged sofort die Löschung), oder (b) die gelöschte Datei explizit in die `git add`-Liste aufnehmen (`git add -A src/components/cms/<name>.tsx`), oder (c) nach jedem Commit `git ls-tree HEAD <dir> | grep '\.tsx$'` gegen erwarteten Bestand prüfen. Verifikation am Slice-Ende: `git status --short` darf KEINE ` D`-Einträge (unstaged deletions) zeigen.
