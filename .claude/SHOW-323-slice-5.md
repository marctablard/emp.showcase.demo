# Slice 5 — Layout-Pipeline + Banner-Voll-Migration

> **Branch**: feature/SHOW-323-slice-5 (von gitea/master `9938af7`)
> **Vorgänger**: Slice 4 merged
> **Baseline**: 129 Suites / 1144 Tests
> **Modus**: Pro-Slice-Ablauf ohne User-CR ([[feedback_quality_gates_per_slice]])
> **Scope-Größe**: ~25-35 Files (Architekt-Schätzung, User-OK 2026-05-20)

## Goal

Layouts als erste-Klasse-Konzept einführen. Layout-Pipeline: `cms.getLayout(layoutId, locale, site)` → Renderer setzt Page-Body an der `content-slot`-Position des Layouts ein. Banner wird Co-Location-Komponente, im Default-Layout-JSON als Block. `use-banner.ts` + `lib/storyblok.tsx`-Reste entfallen.

## Architekt-Entscheidungen (verbindlich)

User-Klärungen 2026-05-20:

| # | Entscheidung |
|---|---|
| **A1** | Layout ist conceptionell eine Page-mit-ContentSlot. Schema-Struktur: separater Discriminator `type: 'layout'`, gleiches `body: CMSComponent[]`-Pattern wie `page`. Im body muss **transitiv** genau ein `content-slot`-Element vorhanden sein (Zod `.refine()`-Validation, kein hartes Schema-Slot-Field). |
| **A2** | `ContentSlot` ist eine reguläre Komponente im `cmsComponentMap` (`type: 'content-slot'`). Renderer special-cased sie: an Stelle der `content-slot`-Komponente werden die Page-Body-Children eingesetzt. Page-Body wird via React-Context (oder Prop) durchgereicht. |
| **A3** | Banner Voll-Migration: `top-banner-announcement` wird Co-Location-Komponente (`src/components/cms/top-banner-announcement/{schema.ts, top-banner-announcement.tsx, top-banner-announcement.test.tsx, index.ts}`). Im Default-Layout-JSON referenziert. `use-banner.ts` + `/api/cms/banner`-Route (falls existiert) + `lib/storyblok.tsx`-Accessor + Test entfallen. |
| **A4** | Layout-Cache: 1h TTL (3_600_000 ms), `globalThis`-Pattern wie Page-Cache aus Slice 1. ENV `NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS` mit Default. |
| **A5** | Layout-Auswahl hybrid: `page.layoutId?: string` optional, Fallback `'default'`. Wenn Adapter kein Layout liefert → `<CmsPage>` rendert direkt die Page-Body (Fallback ohne Layout, Edge-Case-Resilienz). |
| **A6** | Slice-6 (Per-Site-Theming) entfällt — User-Entscheidung 2026-05-20: globales CSS bleibt, Theming-Erweiterung wäre out-of-scope für SHOW-323. |

## Scope (File-Inventar)

### Neu — Komponenten (Co-Location)

| Datei | Was |
|---|---|
| `src/components/cms/layout/schema.ts` | `LayoutSchema` mit Zod `.refine()` "transitiv genau ein content-slot" |
| `src/components/cms/layout/layout.tsx` | Server-Component, rendert Body-Items (gleiches Pattern wie `page.tsx`) |
| `src/components/cms/layout/layout.test.tsx` | Schema-Tests + Render-Tests |
| `src/components/cms/layout/index.ts` | Re-Export |
| `src/components/cms/content-slot/schema.ts` | `ContentSlotSchema` (`type: 'content-slot'`, ggf. optionales `slotId`) |
| `src/components/cms/content-slot/content-slot.tsx` | "Marker"-Komponente — rendert via Context die Page-Body-Children |
| `src/components/cms/content-slot/content-slot.test.tsx` | Tests inkl. Context-Konsum |
| `src/components/cms/content-slot/index.ts` | Re-Export |
| `src/components/cms/top-banner-announcement/schema.ts` | Co-Location-Schema (extrahiert aus heutigem flachen File) |
| `src/components/cms/top-banner-announcement/top-banner-announcement.tsx` | Component (Co-Location, ggf. mit Pattern-A-Insel falls Hooks/Browser-API drin sind) |
| `src/components/cms/top-banner-announcement/top-banner-announcement.test.tsx` | Tests |
| `src/components/cms/top-banner-announcement/index.ts` | Re-Export |

### Neu — Service / Integration

| Datei | Was |
|---|---|
| `src/platform/services/cms/layout-cache.ts` | `globalThis`-basierter TTL-Cache pro `(layoutId, locale, site)`-Key, ENV-konfigurierbar |
| `src/platform/services/cms/layout-cache.test.ts` | Cache-TTL + Invalidation-Pattern (für Slice 7 Webhook vorbereitet) |

### Geändert — Service / SPI

| Datei | Änderung |
|---|---|
| `src/platform/services/cms/CMSService.d.ts` | `getLayout(layoutId, locale, site): Promise<CMSLayout \| CMSNoResult>`-Methode |
| `src/platform/services/cms/CmsAdapter.d.ts` | `getLayout`-SPI-Methode |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.ts` | Delegation + Cache-Integration |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.test.ts` | Tests für getLayout-Delegation + Cache-Hit/-Miss |
| `src/platform/services/cms/impl/NullCmsAdapter.ts` | `getLayout` returnt `{ notfound: true }` |
| `src/platform/services/cms/impl/NullCmsAdapter.test.ts` | Test ergänzt |
| `src/platform/integrations/mock/cms/impl/MockCmsAdapter.ts` | `getLayout` liest aus `src/data/cms/<site>/<locale>/_layouts/<layoutId>.json` |
| `src/platform/integrations/mock/cms/impl/MockCmsAdapter.test.ts` | Tests ergänzt |
| `src/platform/integrations/mock/cms/impl/MockCmsAdapter.contract.test.ts` | Contract-Erweiterung (getLayout-SPI-Invarianten) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.ts` | `getLayout` via `StoryblokCmsApi.getStory('_layouts/<layoutId>')` |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.test.ts` | Tests ergänzt |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.contract.test.ts` | Contract-Erweiterung |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.ts` | Story → CMSLayout Mapping (analog zu Page-Mapping) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.test.ts` | Tests für Layout-Mapping |
| `src/platform/services/model/cms/cms-content.d.ts` | `CMSLayout`-Type ergänzen |

### Geändert — Component-Map + Render-Pipeline

| Datei | Änderung |
|---|---|
| `src/components/cms/component-map.ts` | `layout`, `content-slot`, `top-banner-announcement` Einträge ergänzen |
| `src/components/cms/component-schema.ts` | Schema-Union erweitern |
| `src/components/cms/component-map.test.ts` | Drift-Guard-Inventar von 19 auf 22 ergänzen |
| `src/components/cms/page/schema.ts` | Optionales `layoutId: z.string().optional()` ergänzen |
| `src/components/cms/page/page.test.tsx` | Schema-Test für `layoutId` |
| `src/components/cms/cms-page.tsx` | Layout-Resolution: `layoutId = page.layoutId ?? 'default'`, `cms.getLayout(...)` Call, Page-Body als Context für ContentSlot |
| `src/components/cms/cms-page.test.tsx` | Tests ergänzt (Layout-Resolution, Fallback ohne Layout) |
| `src/components/cms/cms-renderer.tsx` | `content-slot` Special-Case via React-Context, sonst unverändert |
| `src/components/cms/cms-renderer.test.tsx` | Tests für ContentSlot-Rendering |
| `src/components/cms/container-init-order-drift.test.ts` | `layout` als rekursiver Container ergänzen (transitiv content-slot enforced) |

### Neu — Fixture

| Datei | Inhalt |
|---|---|
| `src/data/cms/_default_/de/_layouts/default.json` | Default-Layout DE: navigation + top-banner-announcement + content-slot + footer |
| `src/data/cms/_default_/en/_layouts/default.json` | Default-Layout EN |
| `src/data/cms/_default_/de/home.json` | Update: `layoutId: 'default'` (oder einfach implizit) |
| `src/data/cms/_default_/en/home.json` | Update |

### Gelöscht

| Datei | Grund |
|---|---|
| `src/components/cms/top-banner-announcement.tsx` (flach) | Wird Co-Location |
| `src/components/cms/top-banner-announcement.test.tsx` (falls existiert) | Co-Location-Migration |
| `src/hooks/banner/use-banner.ts` | Banner ist jetzt CMS-Komponente im Layout |
| `src/hooks/banner/use-banner.test.tsx` | dito |
| `src/app/api/cms/banner/route.ts` (falls existiert) | dito |
| `src/lib/storyblok.tsx` | Transitional aus Slice 4 — letzter Konsument war `use-banner.ts`, der jetzt weg ist |
| `src/lib/storyblok.test.tsx` | dito |

### ENV / Doku-Mini

| Datei | Änderung |
|---|---|
| `.env.template` | `NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS=3600000` (default 1h) dokumentiert |

## Phasing (innerhalb des Slices)

| Phase | Was |
|---|---|
| **P1** | Schema-Foundation: Layout + ContentSlot + Banner Co-Location + Component-Map erweitern + Drift-Guard angepasst |
| **P2** | SPI-Erweiterung: `getLayout` in `CMSService` + `CmsAdapter` + Mock/Null/Storyblok-Impl + Contract-Tests |
| **P3** | Render-Pipeline: `cms-page.tsx` Layout-Resolution + `cms-renderer.tsx` ContentSlot-Context + Default-Layout-Fixture |
| **P4** | Banner-Migration: `top-banner-announcement` Co-Location migrieren + `use-banner.ts` retire + `lib/storyblok.tsx` final löschen |
| **P5** | Browser-Smoke + Cross-Review |

## Verhalten-Constraints (Decision 23)

- Banner-Render visuell 1:1 zur heutigen `top-banner-announcement.tsx`-Render-Output
- Page-Render: wenn kein `layoutId` und kein default-Layout vorhanden → Fallback auf direkte Page-Body-Render (kein Crash, A5)
- ContentSlot mit Page-Body-Children: gleiche DOM-Reihenfolge wie Layout-Body-Position
- Cache-Behavior: erste Anfrage Cache-Miss, zweite Anfrage innerhalb TTL Cache-Hit (durch Test gepinnt)

## Quality Gates (alle 10 vor Push)

Siehe [[feedback_quality_gates_per_slice]]. Spezifika für Slice 5:

- **Gate 6 (Browser-Smoke)**: testing-engineer testet
  - `NEXT_PUBLIC_CMS_PROVIDER=mock` mit fixture-Default-Layout — Layout rendert mit Banner + Navigation + Content + Footer; Page-Body wird an ContentSlot eingesetzt
  - `NEXT_PUBLIC_CMS_PROVIDER=storyblok` ohne Token — Fallback verifiziert (kein Crash)
  - Console: 0 Errors, 0 Warnings
- **Gate 8 (Verhaltens-Pinning)**: Banner-Render muss visuell-identisch zur Pre-Migration-Form sein (DOM-Equivalence-Check im Mapper-Test oder Component-Test)
- **Test-Count-Erwartung**: 129 Suites + ~7-10 neue Suites → 136-139 Suites

## Stop-and-Ask-Lagen (zu erwartende)

- **ContentSlot mit `slotId`?** Falls Layout mehrere "Slots" haben soll (z. B. ein Slot für Page-Body, ein Slot für Sidebar) — heute nicht spezifiziert, ich gehe mit Single-Slot ohne `slotId`. Bei mehr-als-einem-Slot-Bedarf: Stop-and-Ask.
- **`top-banner-announcement` Pattern-A vs. Server**: schau ich beim Migration-Schritt, ob Hooks/Browser-API drin sind. Wenn ja: Pattern-A-Insel (analog zu `Hero`, `MediaText` etc.). Wenn nicht: pures Server-Component.

## Hand-off

1. testing-engineer Strategie-Modus → Test-Strategie pro File
2. testing-engineer Pre-Implementation-Modus → failing Akzeptanz-Tests
3. frontend-developer Build-Modus → iterative Phasen P1-P4
4. Cross-Review-Loop (Architect + testing-engineer parallel, bis 0 Findings)
5. Architect Push + PR + Merge (ohne User-CR, ggf. User-Spot-Check)

## Lessons-Learned-Anhang (wird nach Slice-Done befüllt)

(leer)
