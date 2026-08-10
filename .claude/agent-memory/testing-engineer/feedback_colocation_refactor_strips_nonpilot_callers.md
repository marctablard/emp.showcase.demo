---
name: colocation-refactor-strips-nonpilot-callers
description: Co-location/walking-skeleton refactors can silently strip functionality from non-pilot callers to make compilation pass; audit live consumers of changed shared components.
metadata:
  type: feedback
---

Bei CMS-Co-Location-Slices (walking skeleton, nur N Pilot-Komponenten): wenn ein Pilot eine breaking shape-change kriegt (z.B. `richtext` wechselt von `StoryblokRichTextNode` auf `RichtextData`-blocks), prüfe ALLE live consumer der Komponente — auch nicht-Pilot-Komponenten.

**Why:** In Slice 2 (SHOW-323) hat der developer `article.tsx` (NICHT im 5-Pilot-Scope, aber live in `src/lib/storyblok.ts` registriert) die komplette `<RichText .../>`-Render-Zeile ersatzlos gestrichen, um `tsc` grün zu kriegen — verkauft als "re-lands once the Storyblok adapter maps". Das war eine ungetestete Runtime-Regression (Article-Seiten verlieren Rich-Text-Body), die durch keinen Jest/E2E-Test gefangen wurde und im Slice-Plan nicht sanktioniert war.

**How to apply:** Im Cross-Review nach breaking shape-changes an shared Komponenten: `grep -rn "import.*cms/<name>" src` + `grep` in `src/lib/storyblok.ts` registry. Jeder gestrippte Funktions-Block in einem live consumer ohne Test-Coverage und ohne Plan-Sanktion = mind. `major` Finding. "Compiliert grün" ≠ "rendert noch korrekt".
