---
name: test-contract-drift-check
description: Cross-Review-Pflicht — modifizierte Test-Files immer auf gelockerte Assertions prüfen. Pure Additions OK, aber jede `expect()`-Lockerung ohne Bug-Fix ist ein Blocker-Finding.
metadata:
  type: feedback
---

Bei jedem Cross-Review modifizierte Test-Files explizit prüfen: sind Assertions gelockert worden (statt den Bug zu fixen)?

**Why:** User hat in SHOW-323 Slice 3 Iteration 4 explizit klargestellt: „Tests-anpassen-zum-grünmachen ist nicht legitim". Wenn ein bestehender `expect(X).toBe(Y)` zu `expect(X).toBe(Z)` modifiziert wurde, weil der Code `Z` statt `Y` produziert, ist das ein Vertragsbruch — der Engineer hätte den Bug fixen müssen, nicht den Vertrag. Pure Additions (neue `it()`-Blöcke) sind dagegen legitim.

**How to apply:**

1. Diff-Range bilden: `git diff master..HEAD --name-status -- 'src/**/*.test.ts' 'src/**/*.test.tsx' 'e2e/**'`.
2. Pro `M`-Eintrag (Modifikation): `git diff master..HEAD -- <file>` lesen.
3. Klassifizierung:
   - **Pure Addition** (nur neue `it()`-Blöcke, neue Test-Cases, neue Helpers): OK.
   - **Erweiterung einer Liste / eines Mocks** (z. B. `expect(keys).toEqual([...])` wird länger weil ein neuer Optional-Env-Var hinzugekommen ist): OK, sofern die Erweiterung durch eine Code-Änderung in dieselbe Direction begründet ist (vorher 2 Optional-Vars → jetzt 3, weil neuer Var registriert wurde).
   - **Gelockertes Assert** (`expect(X).toBe(2)` → `expect(X).toBe(3)` OHNE dass es einen Bug-Fix gibt; oder `expect(arr).toHaveLength(5)` → `expect(arr).toHaveLength(0)` weil der Code jetzt leer rendert): **BLOCKER**. Verlangt Erklärung im PR-Body oder explizite Code-Begründung im Test-Kommentar.
   - **Snapshots ersetzt** (`toMatchSnapshot()` neu geschrieben statt Source-Bug gefixt): **BLOCKER**.

4. In Slice 3 Iteration 4 war der einzige Test-File-`M`: `src/platform/healthcheck/__tests__/env-validation.test.ts` — Liste der Optional-Keys von 2 auf 3 erweitert (`NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` neu in Optional eingetragen), plus 4 neue `it()`-Blöcke für die neue Semantik. **Legitim** — Erweiterung in Direction der Code-Änderung (Storyblok-Token wurde optional gemacht in Slice 1).

5. In den Output-Bericht klar notieren: „Test-Vertrag-Drift: keine" oder „Test-Vertrag-Drift: 1 Modifikation, legitim (Erklärung: ...)".
