# Slice 3 — Restliche 15 Default-Komponenten (Walking-Skeleton-Vervollständigung)

> **Parent**: [`SHOW-323-plan.md`](./SHOW-323-plan.md)
> **Vorgänger**: Slice 2 (gemerged auf `feature/SHOW-323` Range `184669a..2236ae2`)
> **Branch**: `feature/SHOW-323` direkt drauf

---

## 1. Goal

Default-Komponenten-Foundation **komplett**. Alle 20 CMS-Komponenten in Co-Location-Pattern + Component-Map + Discriminated Union. `'use client'`-Audit auf alle 15 migrierten Komponenten. Type-Cleanups aus Slice-2-Cross-Review.

## 2. Out-of-Scope

- Storyblok-Wrapper-Komponenten löschen (`src/components/cms/storyblok/storyblok-component.tsx`) → **Slice 4**.
- Article-RichText-Migration (`<RichtextStoryblok>` → `<Richtext>`) → **Slice 4** (braucht TipTap→AST-Mapper im Adapter).
- Storyblok-`storyblok.tsx`-Lib-Helper löschen → **Slice 4**.
- Renderer-Umbau auf `cmsComponentMap` (Slice 4).
- Layout-Page-Konzept für Banner → **Slice 5**.

## 3. Komponenten-Inventar (15 Stück) + Migration-Reihenfolge

Topological — Abhängigkeiten von unten nach oben aufgelöst:

### Tier 1 — Atoms (keine CMS-Komponenten-Imports, niedrigstes Risiko)

| # | Name | Heute `'use client'`? | Echte Client-API? | Nach Migration |
|---|---|---|---|---|
| 1 | `logo` | ja | nein | Server |
| 2 | `video` | nein | nein (`<Video>` selbst keine Hooks?) | Server (prüfen) |
| 3 | `teaser` | ja | nein | Server |
| 4 | `quick-entry` | nein | nein (im Storyblok-Wrapper-Pattern, aber Inner Server-tauglich) | Server |

### Tier 2 — Mid (nutzt Atoms)

| # | Name | Heute `'use client'`? | Echte Client-API? | Nach Migration |
|---|---|---|---|---|
| 5 | `feature` | ja | nein | Server |
| 6 | `category` | ja | nein | Server (vermutlich) |
| 7 | `segment` | ja | nein | Server |
| 8 | `recommendations` | ja | **prüfen** — heute mit Storyblok-Wrapper, vermutlich Client-Carousel | Pattern A bei Bedarf |
| 9 | `column-teaser` | ja | nein | Server |

### Tier 3 — Banner

| # | Name | Heute `'use client'`? | Echte Client-API? | Nach Migration |
|---|---|---|---|---|
| 10 | `top-banner-announcement` | ja | nein (rein Render) | Server |

### Tier 4 — Cross-deps

| # | Name | Imports | Nach Migration |
|---|---|---|---|
| 11 | `media-text` | `Button` aus `./button`, `Video` aus `./video`, `TextEditorData` aus `./hero` (Slice-2-Restanz) | Server-Component; bringt `TextEditorData`-Move nach `_shared/` mit |
| 12 | `article` | `Link` aus `@/i18n/navigation`, `RichtextStoryblok`, `H1..H3` | Server-Parent + Client-Insel für Link (Pattern A); RichTextStoryblok bleibt drin (Slice 4 löst das) |

### Tier 5 — Container (Recursion mit `z.lazy(CMSComponentSchema)`)

| # | Name | Spezial |
|---|---|---|
| 13 | `columns` | `body[]`-Recursion. `<columns>` enthält weitere CMS-Komponenten. Side-Effect-Import (`import '../component-schema';`) im `<name>/index.ts` Pflicht — Decision 19. |
| 14 | `grid` | `columns[]`-Recursion. Gleiches Pattern. |

### Tier 6 — Spezial

| # | Name | Spezial |
|---|---|---|
| 15 | `navigation` | Domain-Type `CMSNavigation` lebt schon in `src/platform/services/model/cms/navigation.d.ts` (Slice 1). Komponente importiert ggf. — Type-Re-Export-Konsistenz prüfen. |

## 4. Type-Cleanups (mit den Komponenten-Migrations zusammen)

| Item | Wann | Wo |
|---|---|---|
| `HeroVideoSchema` an `VideoData` angleichen, Cast in `hero/hero-svg.tsx` entfernen | mit Tier-1 `video` | `src/components/cms/video/schema.ts` (neu) + `src/components/cms/hero/schema.ts` + `hero-svg.tsx` |
| `TextEditorData` aus `hero/schema` nach `_shared/text-editor.schema.ts` rauslösen | mit Tier-4 `media-text` | neuer `src/components/cms/_shared/text-editor.schema.ts` + Update von hero+media-text |
| Button-Klassen ggf. ausbauen (Cross-Review-Nit N2) | optional, mit `button`-Refactor nicht zwingend | `button/button.tsx` |

## 5. Konvention für jede Komponenten-Migration

Pattern aus Slice 2 (Decision 21 + 22 + Naming-Konvention):

1. Co-Location: `src/components/cms/<name>/{schema.ts, <name>.tsx, <name>.test.tsx, index.ts}`
2. Schema: Zod, `'use client'`-frei, `(Name)Schema` + `(Name)Data` (z.infer)
3. Component: `(Name)Props = (Name)Data & HTMLAttributes<HTMLElement>`, `...rest` aufs Root spreaden, `className` via `cn(...)` mergen
4. Default-Export Component, named `(Name)Props`
5. Index: re-exportiert Schema + Data + Component + Props
6. Map-Eintrag in `component-map.ts` (alphabetisch sortiert)
7. Schema-Eintrag in `component-schema.ts` Discriminated Union
8. **Pre-Audit pro Komponente** (vor `'use client'`-Drop):
   ```
   grep -nE "useState|useEffect|useRef|useMemo|useCallback|onClick|onChange|onSubmit|window\.|document\.|localStorage|sessionStorage" src/components/cms/<name>.tsx
   ```
   Bei Treffer → Pattern A (Client-Insel extrahieren) **statt** komplettem Client-Component.
9. **Verhalten 1:1 erhalten** (Decision 23) — keine eigenmächtigen Vereinfachungen.

## 6. Caller-Konsistenz (Storyblok-Wrappers)

5 Komponenten werden heute durch `src/components/cms/storyblok/storyblok-component.tsx` gewrappt:
- `StoryblokHero` ✓ (Slice 2)
- `StoryblokButton` ✓ (Slice 2)
- `StoryblokQuickEntry`  ← Slice 3 betrifft `quick-entry`
- `StoryblokColumnTeaser` ← Slice 3 betrifft `column-teaser`
- `StoryblokRecommendations` ← Slice 3 betrifft `recommendations`

Die Wrapper-Imports zeigen auf `../<name>`-Directory-Resolution → funktionieren **automatisch** weiter, sobald `<name>/index.ts` existiert. Keine Caller-Update nötig.

`src/lib/storyblok.tsx` Map-Imports (`Article from '@/components/cms/article'` etc.) ebenfalls per Directory-Resolution → automatisch.

## 7. Schichten-Schnitt

| Cluster | Files |
|---|---|
| Neu (60 = 15 × 4) | `src/components/cms/<name>/{schema.ts, <name>.tsx, <name>.test.tsx, index.ts}` × 15 |
| Geändert | `component-map.ts` (+15 Einträge), `component-schema.ts` (+15 Schemas), evtl. `component-map.test.ts` (Drift-Guard erweitert sich automatisch) |
| Gelöscht | alte flache `src/components/cms/<name>.tsx` × 15 |
| Neu (Shared) | `src/components/cms/_shared/text-editor.schema.ts` (mit `media-text`) |
| Geändert (Type-Cleanup) | `src/components/cms/hero/schema.ts` (Video-Schema-Referenz, TextEditorData raus), `src/components/cms/hero/hero-svg.tsx` (Cast raus mit `video`-Migration) |

## 8. Akzeptanzkriterien

Pro Komponente:
- [ ] Co-Location-Pattern erfüllt
- [ ] Pre-Audit dokumentiert (Server- oder Client-Component-Entscheidung mit Begründung)
- [ ] Pattern A angewandt wo Client-Logic vorhanden
- [ ] Schema-Tests + Spread-Test grün
- [ ] In `component-map.ts` und `component-schema.ts` registriert

Übergreifend:
- [ ] Alle 20 Komponenten in der Map (Drift-Guard grün)
- [ ] `npm test` grün **pro Commit** (Big-Bang mit sauberen Commit-Schritten)
- [ ] Lint / TSC / Build / verify:client-chunks grün
- [ ] Storyblok-Wrappers funktionieren weiter (Test-Suite + manueller Smoke optional)
- [ ] `'use client'`-Footprint minimiert: pre-Slice-3 hatten 13/15 Komponenten unnötig `'use client'` — nach Slice 3 sollten es ≤2 + Pattern-A-Inseln sein

## 9. Commit-Plan (pro Komponente ein Commit)

In topologischer Reihenfolge (siehe §3):

| # | Commit-Subject |
|---|---|
| 1 | `feat(cms/logo): co-locate as server component` |
| 2 | `feat(cms/video): co-locate with schema; align with HeroVideoSchema` |
| 3 | `feat(cms/teaser): co-locate as server component` |
| 4 | `feat(cms/quick-entry): co-locate as server component` |
| 5 | `feat(cms/feature): co-locate as server component` |
| 6 | `feat(cms/category): co-locate as server component` |
| 7 | `feat(cms/segment): co-locate as server component` |
| 8 | `feat(cms/recommendations): co-locate with pattern A if client logic present` |
| 9 | `feat(cms/column-teaser): co-locate as server component` |
| 10 | `feat(cms/top-banner-announcement): co-locate as server component` |
| 11 | `refactor(cms/_shared): extract TextEditorData into shared schema module` |
| 12 | `feat(cms/media-text): co-locate as server component using shared TextEditorData` |
| 13 | `feat(cms/article): co-locate with pattern A for Link island (RichtextStoryblok kept)` |
| 14 | `feat(cms/columns): co-locate with recursive z.lazy schema` |
| 15 | `feat(cms/grid): co-locate with recursive z.lazy schema` |
| 16 | `feat(cms/navigation): co-locate as server component` |
| 17 (opt.) | `refactor(cms/hero): drop HeroVideoSchema cast after video migration` |

≈ **16-17 Commits**.

Pro Commit:
- Alle neuen Files für die Komponente
- Alte flache `<name>.tsx` gelöscht
- `component-map.ts` + `component-schema.ts` ergänzt
- `npm test` grün

## 10. Hand-off-Sequenz

1. `testing-engineer` (Strategie-Modus) — verfeinert Test-Strategie pro Komponente (insbesondere die 5 Storyblok-gewrappten und die 2 Container).
2. `testing-engineer` (Pre-Implementation) — committed failing Stub-Tests + Stub-Files (analog zu Slice 2 Pre-Implementation).
3. `frontend-developer` (Build) — implementiert pro Komponente einen Commit. Pre-Audit + Pattern A bei Bedarf.
4. Cross-Review: architect (Diff gegen `main` für Slice-Abschluss-Kontext) + testing-engineer (Coverage, `'use client'`-Audit-Befund).
5. Browser-Smoke gegen `dev:next`.
6. Push zu `gitea`.

## 11. Risiken

| Risiko | Mitigation |
|---|---|
| Container-Recursion (`columns`, `grid`) wiederholt das Init-Order-Pattern aus Slice 2 | Side-Effect-Import in `<name>/index.ts` Pflicht — Decision 19. Smoke-Test für TDZ-Resolution. |
| Storyblok-Wrappers (`StoryblokQuickEntry`, `StoryblokColumnTeaser`, `StoryblokRecommendations`) brechen durch Spread-Refactor | Wrappers nutzen `cloneElement` mit `{...blok}`-Spread — funktionieren weiter mit `HTMLAttributes`-Spread auf neuer Component-Root. Storyblok-E2E (falls vorhanden) als Sicherheitsnetz. |
| `media-text` braucht `TextEditorData` von `hero/schema` — vor Video-Migration | Reihenfolge: Tier 1 (`video`) vor Tier 4 (`media-text`). Shared-Schema-Move ist eigener Commit (#11). |
| `recommendations` hat möglicherweise echte Client-Logic (Carousel/Slider) | Pre-Audit pro Komponente. Pattern A wenn nötig. |
| `article` Pattern A für Link-Island | Slice-2-Pattern bewährt (content-block). |
| `'use client'`-Audit zu konservativ (lasse zu viele Client-Components) oder zu aggressiv (Bricht durch Hidden-Hooks) | Pre-Audit-Grep ist Pflicht; bei Treffern stoppen + an architect rückfragen (Decision 24). |

## 12. Browser-Smoke nach Slice 3

`dev:next` läuft (User-Setup), Playwright + `npm test` grün. Plus manuell:
- Storyblok-Test-Story mit verschiedenen Komponenten-Typen (Hero, Button, ContentBlock, Quick-Entry, Column-Teaser, Recommendations, Media-Text, Article — die heute genutzten Storyblok-Blöcke)
- Mobile + Desktop Viewport
- Klick-Interaktionen prüfen

Akzeptanz: visuelles + funktionales Verhalten **1:1** zum Pre-Slice-3-Stand.
