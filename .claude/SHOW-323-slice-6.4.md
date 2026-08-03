# Slice 6.4 — CMS Close-out: Migrations-Regressionen + Pivot-Debris (P3)

> **Branch**: `feature/SHOW-323`. PR `head=feature/SHOW-323`, `base=feature/SHOW-323-target`.
> **Modus**: autonom, kein User-CR pro Slice. PR am Ende.
> **Vorgänger**: PR #9 (SDK-Pivot, ADR 0001) — kann parallel gemergt werden; 6.4 baut auf `feature/SHOW-323` auf.
> **Kontext**: Schließt die CMS-Integration korrekt ab. Enthält (a) Migrations-Regressionen, die der CMS-Umbau eingeführt hat, (b) den Navigation-Seam-Leak, (c) ein verifiziertes Pivot-Debris (totes schweres Mapping). NICHT enthalten: P4 (getLayout/Cache-Removal) — eigener Follow-up, weil es Slice-7-Webhook-Semantik ändert.

## Architekt-Entscheidungen (verbindlich)

### Regressionen (Pflicht — die Migration hat sie verursacht)

| # | Entscheidung |
|---|---|
| **DR1** | **Breadcrumb-Restore in `cms-page.tsx`** (BLOCKER — Funktions-Regression). Master rendert bei `no_margin === false` einen `<UiBreadcrumb items={breadcrumb} className="max-w-6xl mx-auto px-4 lg:px-9 sm:gap-x-6" />`. Beim CMS-Umbau verloren gegangen. `buildBreadcrumb` bleibt im Shell (UI-Routing-Logik), nicht ins Service-Layer. **Wichtig — post-Pivot**: Der Shell delegiert Rendering jetzt an `cms.renderPage`. Der Breadcrumb gehört in den **agnostischen Shell** (über/um das `renderPage`-Ergebnis), provider-unabhängig — er wird NICHT Teil des SDK-Render-Pfads. Konkret: Shell holt `getPage` (für no-result/margin/breadcrumb-Daten) + ruft `buildBreadcrumb`, rendert den Breadcrumb-Strip + dann `{body}` aus `renderPage`. |
| **DR2** | **Richtext-Revert** (MAJOR — unautorisierte Styling-Änderung). In der **shared** `src/components/cms/richtext/richtext.tsx`: `ml-4` zurück auf `<li>` (von `<ol>`/`<ul>` entfernen); tote `richtext`-Wrapper-Klasse entfernen; erfundene Block-Kinds (`blockquote`, `code`, `image`) entfernen → zurück auf Master-Verhalten (TEXT-Default). Gilt für den **agnostischen Richtext-AST-Renderer** (den beide Adapter speisen — Mock via component-map, Storyblok via wiederverwendetes `mapRichtext`). |
| **DR3** | **Recommendations-Revert** (MINOR). `src/components/cms/recommendations/recommendations.tsx`: `return null` im no-data-/error-Pfad wiederherstellen (statt leerem Wrapper-`<div>`). |

### Seam-Leak (Architektur-Konsistenz, ADR 0001)

| # | Entscheidung |
|---|---|
| **DR4** | **Navigation `_uid`→`id`**. `src/components/cms/navigation/schema.ts` + `navigation.tsx` (+ `navigation-item`): `_uid` (Storyblok-Feldname) durch agnostisches `id` ersetzen. Der Mapper (`StoryblokCmsMapper.mapComponent`) schreibt bereits `id` — Navigation muss es konsumieren statt `_uid`. Entfernt den Storyblok-Leak aus der agnostischen Schicht. |

### Pivot-Debris (verifiziertes totes schweres Mapping)

| # | Entscheidung |
|---|---|
| **DR5** | **Storyblok `getPage` auf Metadata-only verschlanken**. Verifiziert: `StoryblokCmsAdapter.getPage` → `mapper.mapPage` mappt den **vollen** Component-Tree inkl. `mapRichtext` (TipTap→AST). Nach dem Pivot wird `CMSPage.components[]` für Storyblok **nie gerendert** (renderPage nutzt SDK). → Neue Mapper-Methode `mapPageMetadata(story): CMSPage` (oder Parameter), die NUR `title/description/url/no_margin/layoutId` mappt und `components: []` lässt. `getPage` (Storyblok) nutzt sie. **Mock bleibt unverändert** (Mock rendert über `components[]` — die braucht es voll). `mapPage` (volles Mapping) bleibt für Mock/andere Konsumenten erhalten, falls genutzt — prüfen, ob `mapPage` nach Umstellung noch einen Storyblok-Caller hat; wenn nein und auch sonst keiner: als Teil von DR5 entfernen (Deletion-Test im Build). |

## Scope (File-Inventar)

| Datei | Änderung | Tests |
|---|---|---|
| `src/components/cms/cms-page.tsx` | DR1: Breadcrumb-Strip + `buildBreadcrumb` im Shell, um `renderPage`-Body | RTL: Breadcrumb bei `no_margin===false` da, bei `true` nicht; delegiert weiter an renderPage |
| `src/components/cms/richtext/richtext.tsx` | DR2: List-Class-Revert, tote Klasse weg, Block-Kinds weg | RTL: `<li>` hat `ml-4`, `<ol>/<ul>` nicht; kein `richtext`-class; blockquote/code/image → Text-Default |
| `src/components/cms/recommendations/recommendations.tsx` | DR3: `return null` no-data | RTL: no-data/error → `firstChild===null` |
| `src/components/cms/navigation/schema.ts` + `navigation.tsx` (+ `navigation-item.tsx`) | DR4: `_uid`→`id` | RTL/Schema: `id` statt `_uid`; React-key nutzt `id` |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.ts` | DR5: `mapPageMetadata` (metadata-only); ggf. `mapPage` entfernen falls callerlos | Unit: mapPageMetadata mappt Metadata, `components: []`, **kein** `mapRichtext`-Aufruf |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.ts` | DR5: `getPage` nutzt `mapPageMetadata` | Unit: getPage liefert Metadata, components leer; renderPage unverändert |
| `src/platform/services/model/cms/cms-content.d.ts` | DR5: Kommentar — `components[]` wird von Storyblok nicht gerendert (Mock-only); kein struktureller Change | — |

## Stop-and-Ask-Resolutionen (Architekt, 2026-05-20)

**SA1 — DR1 `buildBreadcrumb`-Datenquelle (richtig machen, kein Humanize-Hack)**: Master's `buildBreadcrumb` holte pro Slug-Segment den Ancestor-Namen via SDK. Agnostische Lösung: neues Shell-Modul `src/components/cms/build-breadcrumb.ts`, das **Master's Logik 1:1 auf die agnostische SPI portiert** — pro Ancestor-Slug-Segment `CMSService.getPage(ancestorSlug, locale, site)` und das `title`-Feld als Label nimmt. Fallback bei `notfound`: humanisiertes Slug-Segment (Breadcrumb darf nie brechen). `href` = Master's Muster (`/${locale}/${ancestorSlug}`). **className: NICHT raten — `git show master:<storyblok-cms-page-Pfad>` lesen und verbatim restaurieren** (Master hatte lt. testing-engineer `md:px-9`, mein Plan-Paraphrase `lg:px-9` war falsch). Per-Segment-Fetches sind ab DR6 gecacht — bis dahin funktional korrekt, nur ungecacht (gleicher PR). buildBreadcrumb braucht einen eigenen Unit-Test (frontend-developer, Red-Green: per-segment-Fetch + notfound-Fallback).

**SA2 — DR2 erfasst DREI Flächen (sonst non-exhaustive switch / Mapper emittiert Unrenderbares)**: Die erfundenen Block-Kinds `image/quote/code` leben in (a) `richtext/schema.ts` (Zod-Union), (b) `StoryblokCmsMapper` (mapRichtext **emittiert** sie), (c) `richtext.tsx` (Renderer-cases). DR2 entfernt sie aus **allen drei**: Zod-Union-Members raus, Mapper produziert sie nicht mehr (mappt die TipTap-Nodes auf Text/Paragraph wie Master = TEXT-Default), Renderer-cases raus → Switch bleibt exhaustive + typsicher. Faithful-Master: solche Nodes rendern als Text. DR2-File-Scope erweitert: `richtext/schema.ts` + `StoryblokCmsMapper.ts` zusätzlich zu `richtext.tsx`.

**SA3 — DR5 `mapPage` entfernen freigegeben**: verifiziert callerlos (einziger Caller war `getPage:107`, jetzt `mapPageMetadata`). `mapPage` + alte mapPage-Tests entfernen. **`mapLayout`-Removal NICHT hier** — es hängt an `getLayout` (DR6); in DR6 mit-entfernen falls dann callerlos.

## Verhalten-Constraints
- **Kein Touch** am SDK-Render-Pfad (renderPage, Wrapper, Registry) außer DR5-`getPage`-Datenpfad.
- **Kein Touch** am Theming.
- **DR5 darf den Mock-Pfad nicht brechen** — Mock braucht `components[]` voll gemappt. DR5 verschlankt nur den **Storyblok-getPage-Datenpfad**.
- **Browser-Smoke muss weiter grün sein** (Live-Edit, kein Doppel, 0 Console-Errors) — DR5 ändert nur getPage (Metadata), nicht renderPage.

## Test-Strategie (testing-engineer, Pre-Impl)
- DR1: cms-page Breadcrumb-Render-Pin (no_margin-Branch) + weiterhin renderPage-Delegation.
- DR2: richtext List-Marker + Block-Kind-Removal-Pins.
- DR3: recommendations null-Pin.
- DR4: navigation `id`-Pin (kein `_uid` mehr).
- DR5: mapPageMetadata-Unit (Metadata da, components leer, mapRichtext NICHT aufgerufen) + getPage-Storyblok-Unit. Mock-getPage-Tests bleiben grün (voller components-Tree).
- **Drift-Check**: nur ADR-/Regressions-getriebene Änderungen, kein Loosen.
- **Browser-Smoke (Architect, headed)**: Breadcrumb sichtbar auf no_margin-false-Seite; Live-Edit/kein-Doppel/0-Errors unverändert.

## Quality Gates
`lint` · `tsc` · `jest` (voll grün) · `build` · `verify:client-chunks` · Browser-Smoke.

## Stop-and-Ask
- **DR5**: falls `mapPage` (volles Mapping) noch einen legitimen Storyblok-Caller hat, den ich übersehe — nicht entfernen, melden.
- **DR1**: falls `buildBreadcrumb` aus Master auf Slice-1-entfernte Helfer verweist — neu für die agnostische Page-API schreiben, an Architect zurück.

## Hand-off
1. testing-engineer: Test-Strategie + Pre-Impl-Tests (failing). Background.
2. frontend-developer: P1-P5 (DR1-DR5). Background.
3. Cross-Review-Loop (Architect + testing-engineer, 0 Findings).
4. Browser-Smoke (Architect, headed).
5. Commit + PR Gitea.

### Caching-Subsystem korrekt aufsetzen (Option B — "richtig machen", User-Entscheidung 2026-05-20)

| # | Entscheidung |
|---|---|
| **DR6** | **Caching auf Next `revalidateTag` umstellen + totes In-Process-Caching entfernen.** Verifizierter Befund: `PageCache` + `LayoutCache` werden zur Runtime **nie befüllt** (`getPage` ist Passthrough, `getLayout` runtime-tot); `getStory` setzt `revalidate:0` **unconditional** → Storyblok-Content wird **nirgends** gecacht; der Webhook punzt Löcher in leere Caches (No-Op). Korrekte RSC-Lösung: |

**DR6-Teilschritte:**

1. **`StoryblokCmsApi.getStory` — korrektes Next-Caching**:
   - `draft` (Preview): `next: { revalidate: 0 }` (uncached — Live-Edit zeigt sofort). Unverändert.
   - `published`: `next: { tags: [...], revalidate: false }` → von Next gecacht, Invalidierung **ausschließlich** über Tags (Webhook ist der Trigger). Tags: ein granularer pro Story (`cms:story:<resolvedSlug>`) + ein breiter (`cms`). `resolvedSlug` inkl. Multi-Site-Präfix verwenden (Konsistenz mit `resolveSlug`).
   - Verifizieren, dass das SDK (`@storyblok/react/rsc`) den `next.tags`-Teil des dritten `client.getStory`-Args durchreicht (es reicht heute `next.revalidate` durch — gleiches RequestInit.next-Objekt).

2. **Webhook-Invalidierung funktional machen** (`DelegatingCmsServiceSSR.invalidateForWebhook`):
   - `cacheInvalidator.invalidatePage/invalidateLayout/invalidateAll` ersetzen durch `revalidateTag(...)` (aus `next/cache`). Der Webhook-Handler ist ein Route-Handler-Kontext → `revalidateTag` ist dort erlaubt.
   - Granulare Events → `revalidateTag('cms:story:<slug>')` (Tag-Schema identisch zu `getStory`). `null`-Events / fehlendes `mapWebhookPayload` → `revalidateTag('cms')` (breiter Sweep).
   - `mapWebhookPayload` bleibt (Slug→Tag-Mapping); die `WebhookEvent`-Struktur bleibt, nur das Ziel der Invalidierung wechselt von In-Process-Cache zu Next-Tag.

3. **Toten Code entfernen**:
   - `src/platform/services/cms/page-cache.ts` + `layout-cache.ts` + `cache-invalidator.ts` (+ deren Tests) **löschen**.
   - `CmsAdapter.getLayout?` + `CMSService.getLayout` + `DelegatingCmsServiceSSR.getLayout` + `layoutCache`-Feld **entfernen**.
   - `getLayout`-Impl aus `StoryblokCmsAdapter`, `MockCmsAdapter`, `NullCmsAdapter` **entfernen**. (renderPage holt Layout intern via `api.getStory` — bleibt; bekommt published-Tagging aus Teilschritt 1.)
   - `CMSLayout`-Typ: prüfen ob nach getLayout-Removal noch Konsumenten — wenn `renderPage` Layout-Story roh via SDK rendert (nicht via `CMSLayout`), ggf. `CMSLayout` + `mapLayout` auf Deletion-Test prüfen. Mapper `mapLayout`: wird es noch gebraucht? Wenn nein → entfernen.

4. **Slice-7-Webhook-Tests anpassen**:
   - `cache-invalidator.test.ts` **gelöscht** (Modul weg).
   - `DelegatingCmsServiceSSR`-Webhook-Tests: statt `cacheInvalidator`-Spy jetzt `revalidateTag`-Spy (`jest.mock('next/cache')`) — assert: granulare Events → `revalidateTag('cms:story:<slug>')`, `null` → `revalidateTag('cms')`, 401/503 → **kein** `revalidateTag` (Invalidierung nur nach 2xx). Strenge erhalten, kein Loosen.
   - `getLayout`-bezogene Tests (`DelegatingCmsServiceSSR.layout.test.ts`, Layout-Cache-Tests) → löschen (Konstrukt weg, legitime Deletion).

**Constraints DR6:**
- Webhook-Sicherheit (HMAC/Signatur-Validierung, Slice-7 E1) **unverändert** — nur das Invalidierungs-Ziel wechselt.
- `revalidateTag` darf NICHT während Render aufgerufen werden — nur im Webhook-Route-Handler-Pfad (ist erfüllt).
- Browser-Smoke muss grün bleiben (Live-Edit unverändert, da draft weiter `revalidate:0`).
- Published-Render muss funktionieren (getaggter Fetch, kein Bruch).

**DR6-Tests (Pre-Impl):**
- `getStory`: draft → `revalidate:0`; published → `tags:['cms:story:<slug>','cms'], revalidate:false`.
- Webhook: 2xx + page-Event → `revalidateTag('cms:story:<slug>')`; null-Event → `revalidateTag('cms')`; 401/503 → kein `revalidateTag`.
- Deletion-Verifikation: `page-cache`/`layout-cache`/`cache-invalidator`/`getLayout` nicht mehr importierbar (Build/tsc bricht nicht).
