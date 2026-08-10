# Slice 6 — Per-Site-Theming (nachgeholt nach Architect-Fehler)

> **Branch**: `feature/SHOW-323` (von gitea/feature/SHOW-323-target = Slice-7-Stand `5a03fc5`)
> **Vorgänger**: Slice 7 merged in target
> **Baseline**: 145 Suites / 1300 Tests
> **Modus**: Pro-Slice-Ablauf ohne User-CR ([[feedback_quality_gates_per_slice]])
> **Scope-Größe**: ~8-12 Files
> **Story-Status**: Slice 6 holt den am 2026-05-20 fälschlich als ENTFÄLLT markierten Theming-AC nach. **Danach** kommt der finale Story-PR `target → master`.

## Context: warum jetzt erst Slice 6?

User-Aussage am 2026-05-20 *"wenn das CSS für die komplette Codebase gleich ist, lass uns das erstmal so lassen"* wurde vom Architect als endgültige AC-Streichung interpretiert — fälschlich. Ticket-Re-Check via Jira-Screenshot (2026-05-20) bestätigte: **AC #2 fordert Per-Site-Theming explizit**:

> - "Frontend styles and components are broken down to make it possible to use custom CMS with custom styling per site"
> - "(per-site) styles properly propagate to all 'logged-in user' components and if there is no CMS then we use default emporix one"
> - "`docs/styling and theming.md` updated explaining how the customization is done"

Korrektur: Slice 6 wird gebaut, AC #2 wird erfüllt, dann finaler Story-PR.

## Architekt-Entscheidungen (verbindlich)

| # | Entscheidung |
|---|---|
| **TH1** | Pattern: **CSS-Custom-Properties + Cascade**. Theme-Files definieren `:root`-Selector mit Token-Overrides. Tailwind-Utility-Klassen (`bg-surface-action` etc.) erben das Override transitiv. |
| **TH2** | Theme-Lookup: **Static Import-Map** in `src/app/styles/themes/index.ts`. `Record<siteCode, themeModule>` mit `_default_`-Fallback. Next-Bundler dedup'd die CSS-Chunks beim Build. |
| **TH3** | `<SiteThemeStyle siteCode={...} />` Server-Component im Root-Layout. Resolvet siteCode → entweder Site-spezifisches Theme oder Default-Fallback. Rendert `<link rel="stylesheet">`. |
| **TH4** | Theme-Files-Struktur: `_default_.css` ist explizit-empty Override-Slot (Default = bestehende `globals.css`-Tokens). Site-Themes sind reine Differential-Overrides (nur Tokens, die abweichen). |
| **TH5** | Beispiel-Themes für **mindestens 2 Sites** (Demo-Zweck): `main.css` + `us-branch.css` mit jeweils einem sichtbaren Override (z. B. abweichender Primary-Color), damit AC #2 "(per-site) styles properly propagate" beweisbar ist. |
| **TH6** | Doku: `docs/styling-and-theming.md` neu/erweitert. Enthält: Pattern-Erklärung, Token-Liste, Schritt-für-Schritt-Anleitung "wie schreibst du ein Site-Theme", Edge-Cases (Default-Fallback, site ohne Theme-File). |

## Scope (File-Inventar)

### Neu — Theme-Files

| Datei | Was |
|---|---|
| `src/app/styles/themes/_default_.css` | Default-Override-Slot (leer mit Doku-Kommentar — Default-Tokens leben in `globals.css`) |
| `src/app/styles/themes/main.css` | Beispiel-Theme für Site `main` (mind. 1 sichtbarer Token-Override, z. B. Primary-Color) |
| `src/app/styles/themes/us-branch.css` | Beispiel-Theme für Site `us-branch` (anderer Token-Override) |
| `src/app/styles/themes/index.ts` | Static Import-Map: `Record<siteCode, () => Promise<{ default: string }>>` + Fallback-Resolution |
| `src/app/styles/themes/index.test.ts` | Tests: Map-Lookup, Fallback-Logik, alle Site-Codes auflösbar |

### Neu — Theme-Component

| Datei | Was |
|---|---|
| `src/components/theme/site-theme-style.tsx` | Server-Component, nimmt `siteCode`-Prop, resolvet via Import-Map, rendert `<link rel="stylesheet">` |
| `src/components/theme/site-theme-style.test.tsx` | RTL-Tests: bekannte Site → Site-Link gerendert, unbekannte Site → Default-Link, kein Crash |

### Geändert

| Datei | Änderung |
|---|---|
| `src/app/[site]/[locale]/layout.tsx` | `<SiteThemeStyle siteCode={site} />` direkt nach `<html>` einbinden, vor anderen Stylesheet-Mounts |
| `src/app/[site]/[locale]/layout.test.tsx` (falls existiert) oder neuer Test | Verifiziert, dass Theme-Style im DOM-Output ist |

### Doku

| Datei | Inhalt |
|---|---|
| `docs/styling-and-theming.md` (neu) | Theming-Pattern + Token-Liste + "wie schreibst du ein Site-Theme"-Schritt-für-Schritt + Edge-Cases |
| `docs/cms-framework.md` | Querverweis auf Theming-Doku im "Per-Site-Customization"-Sektion |

## Verhalten-Constraints (Decision 23)

- **Default-Site ohne Theme-File**: kein Crash, kein zusätzlicher `<link>` (oder `<link>` zu `_default_.css`, falls Static-Map das so vorgibt). App-Render visuell identisch zu Pre-Slice-6.
- **Bekannte Site mit Theme-File**: zusätzlicher `<link>` im `<head>`, Theme-Tokens überschreiben `globals.css`-Defaults via CSS-Cascade. Visueller Effekt: Primary-Color (oder anderes Token-Beispiel) ist sichtbar abweichend.
- **Tailwind-Klassen-Verhalten**: keine Änderung. `bg-surface-action` resolvet weiter via CSS-Custom-Property; nur der Property-Wert ändert sich pro Site.

## Quality Gates (alle 10 vor Push)

Spezifika für Slice 6:

- **Gate 6 (Browser-Smoke)**: testing-engineer testet via playwright-cli
  - Site `main`: DOM enthält `<link>` zu `themes/main.css`, computed Primary-Color stimmt mit Override überein
  - Site `us-branch`: DOM enthält anderes `<link>`, computed Primary-Color anders
  - Site ohne Theme (falls vorhanden): nur `globals.css`, keine Console-Errors
- **Gate 8 (Verhaltens-Pinning)**: Vor/Nach-Snapshot — bestehende Pages rendern identisch zu Pre-Slice-6, wenn das Site-Theme leer/Default ist (kein versehentlicher Style-Drift)
- **Test-Count-Erwartung**: 145 Suites + 2-3 neue Suites → 147-148 Suites

## Stop-and-Ask-Lagen

- **Tailwind v4 + CSS-Custom-Properties**: aktuelle Codebase nutzt Tailwind v4 mit CSS-Vars. Falls die Token-Naming-Konvention abweicht, was ich in der Codebase finde: ich melde mich.
- **Site-Code-Liste**: welche Sites tatsächlich existieren (`main`, `us-branch` aus dem `site/config`-Setup). Engineer prüft das im Pre-Audit.

## Hand-off

1. testing-engineer Strategie-Modus → Test-Strategie pro File + Browser-Smoke-Routes
2. testing-engineer Pre-Implementation-Modus → failing Akzeptanz-Tests (`describe.skip`)
3. frontend-developer Build-Modus → iterative Phasen (P1 Theme-Files + Map, P2 SiteThemeStyle, P3 Layout-Mount, P4 Doku)
4. Cross-Review-Loop (Architect + testing-engineer parallel, bis 0 Findings)
5. Architect Push + PR (`head=feature/SHOW-323`, `base=feature/SHOW-323-target`)
6. User mergt
7. **Finale Story-Aktion**: Finaler PR `target → master`

## Lessons-Learned-Anhang (wird nach Slice-Done befüllt)

(leer)
