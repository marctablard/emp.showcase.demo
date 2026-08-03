# Plan: SHOW-323 — Generisches CMS-Adapter-Framework

> **Story**: SHOW-323 "Pre-Sales can easily offer custom content per site"
> **Branch**: feature/SHOW-323
> **Erstellt**: 2026-05-13 von Architect, abgestimmt mit Michael Hammer
> **Status**: bereit zum Hand-off an testing-engineer

---

## 1. Context / Problem

Heutiger Stand:
- `src/lib/storyblok.ts` ruft `storyblokInit()` beim Modul-Load mit `accessToken: process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN || ''`. Ohne Token → **Crash beim Startup**.
- Storyblok ist in mehreren Layern verdrahtet:
  - Globaler `<StoryblokProvider>` in `src/app/[site]/[locale]/layout.tsx`.
  - Direkte SDK-Calls in `src/components/cms/storyblok/storyblok-cms-page.tsx`.
  - Direkter SDK-Call im Browser-Hook `src/hooks/banner/use-banner.ts`.
  - Hardcodierte Imports in `src/app/[site]/[locale]/(no-margin)/page.tsx` und `[...slug]/page.tsx`.
- `CMSService`-Interface existiert bereits, hat aber nur **eine** Impl (`LocalCmsServiceSSR`); Storyblok läuft *parallel* am Service-Layer vorbei.
- Storyblok-Wrapper-Komponenten (`storyblok-component.tsx`) erzeugen einen überflüssigen `<div>`-Wrapper nur für `data-blok-*`-Attribute.
- Theming: Single-Tenant Token-Stack. Kein Per-Site-Override.
- Bestehende `LocalCmsServiceSSR` = "Michi's CMS"; liest `data/cms/[site]/[lang]/[slug].json`.

Ziel laut Story (Update 27.04.2026):
1. **AC #1**: App startet ohne `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`.
2. **AC #2**: CMS-Framework als **Plugin-Architektur** — Storyblok wird zur austauschbaren Impl, neue CMS sind reine additive Plugins. Per-Site-Theming als orthogonaler Hook.

---

## 2. Architektur-Pattern

**Facade + Plugin-Adapter mit Constructor-Injection.**

```
App (UI / Pages / Hooks)
  │  spricht NUR mit CMSService
  ▼
CMSService (Facade)
  │  DelegatingCmsService delegiert an aktiven Adapter
  ▼
CmsAdapter (SPI — austauschbares Plugin)
  │  StoryblokCmsAdapter | LocalJsonCmsAdapter | NullCmsAdapter | …
  ▼
Externes CMS bzw. lokale JSON-Files
```

**Instanziierungsmodell** (konzeptuell):
```ts
new CMSService(new StoryblokAdapter(componentMap))
// componentMap ist CMS-agnostisch (App-Layer).
// StoryblokAdapter pflegt sein Storyblok-Naming intern.
```

**DI-Realisierung via InversifyJS**:
- `CmsComponentMap` (Konstante) wird im SSR-/Server-Container als `bind(...).toConstantValue(...)` registriert.
- Adapter sind `@injectable('CmsAdapter:<id>', 'Singleton')` und nehmen die Map per `@inject('CmsComponentMap')`.
- `DelegatingCmsService` ist `@injectable('CMSService', 'Singleton')` und nimmt den aktiven Adapter per `@inject('CmsAdapter')`.
- `CmsProviderResolver` liest `NEXT_PUBLIC_CMS_PROVIDER` und alias-bindet `'CmsAdapter'` auf `'CmsAdapter:<id>'`.

---

## 3. Schichten-Schnitt

| Datei | Layer | neu/geändert | Tests |
|---|---|---|---|
| `src/platform/services/cms/CMSService.d.ts` | Service | **geändert** (Interface-Erweiterung) | n/a |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.ts` | Service | **neu** (einzige Facade-Impl) | Unit |
| `src/platform/services/cms/CmsAdapter.d.ts` | Service-SPI | **neu** | n/a |
| `src/platform/services/cms/CmsProviderResolver.ts` | Service-Helper | **neu** | Unit |
| `src/platform/integrations/storyblok/cms/StoryblokCmsApi.d.ts` | Integration | **neu** | n/a |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.ts` | Integration | **neu** (SDK-Kapselung, Lazy-Init) | Unit (SDK gemockt) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.ts` | Adapter | **neu** | Unit + Contract |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.ts` | Mapper | **neu** | Unit |
| `src/platform/integrations/storyblok/cms/impl/StoryblokBridgeScript.tsx` | UI/Bridge | **neu** | RTL |
| `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.ts` | Adapter | **neu** (Migration aus LocalCmsServiceSSR) | Unit + Contract |
| `src/platform/services/cms/impl/NullCmsAdapter.ts` | Adapter | **neu** | Unit + Contract |
| `src/platform/services/cms/impl/LocalCmsServiceSSR.ts` | Service | **gelöscht** | — |
| `src/platform/depency.yml` | DI-Config | **geändert** | — |
| `src/platform/healthcheck/env-validation.ts` | Healthcheck | **geändert** (Storyblok → OPTIONAL_ENV_VARS) | Unit erweitern |
| `src/lib/common/public-default-env.ts` | ENV-Defaults | **geändert** | Unit |
| `next.config.ts` | Build | **geändert** | — |
| `.env.template` | Doku | **geändert** | — |
| `src/lib/storyblok.ts` | UI-Lib | **gelöscht** (vollständig migriert) | — |
| `src/providers/StoryblokProvider.tsx` | Provider | **gelöscht** (ersetzt durch `adapter.BridgeScript`) | — |
| `src/components/cms/storyblok/` (ganzer Ordner) | UI | **gelöscht** | — |
| `src/components/cms/local/` (ganzer Ordner) | UI | **gelöscht** | — |
| `src/components/cms/cms-page.tsx` | UI | **neu** (einziger CMS-Page-Einstieg) | RTL + Akzeptanz |
| `src/components/cms/cms-component-renderer.tsx` | UI | **geändert** (Map-Lookup, Editable-Props mergen) | RTL |
| `src/components/cms/component-map.ts` | UI/App-Layer | **neu** (zentrale Component-Map, CMS-agnostisch) | Unit |
| `src/components/cms/<name>/schema.ts` (×17) | Schema | **neu/migriert** (Zod, React-frei) | Unit |
| `src/components/cms/<name>/<name>.tsx` (×17) | UI | **geändert** (`HTMLAttributes`-Spread auf Root) | RTL pro Komponente |
| `src/components/cms/<name>/index.ts` (×17) | Re-Export | **neu** | — |
| `src/app/[site]/[locale]/layout.tsx` | Layout | **geändert** | — |
| `src/app/[site]/[locale]/(no-margin)/page.tsx` | Routing | **geändert** | E2E |
| `src/app/[site]/[locale]/(no-margin)/[...slug]/page.tsx` | Routing | **geändert** | E2E |
| `src/hooks/banner/use-banner.ts` | Hook | **geändert** (ruft `/api/cms/banner`) | Unit |
| `src/app/api/cms/banner/route.ts` | API-Route | **neu** | Integration |
| `src/platform/services/model/cms/cms-content.d.ts` | Domain-Model | **gelöscht/ersetzt** durch `z.infer` aus Schema-Map | — |
| `src/app/styles/themes/_default_.css` | Theming | **neu** (leerer Override) | Visual |
| `src/components/theme/site-theme-style.tsx` | UI/Theme | **neu** (Per-Site-Theme-Loader, orthogonal zum CMS) | RTL |
| `docs/cms-framework.md` | Doku | **neu** ("So baust du einen Adapter") | — |
| `docs/styling-and-theming.md` | Doku | **erweitert** (Per-Site-Theming) | — |
| `docs/local-cms.md` | Doku | **geändert** (Adapter-Pattern) | — |
| `docs/storyblok-integration.md` | Doku | **geändert** (Storyblok als Adapter-Beispiel) | — |

---

## 4. Interfaces

```typescript
// src/platform/services/cms/CMSService.d.ts (Facade)
export interface CMSService {
  readonly providerId: string;
  hasContent(): boolean;
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getBanner(locale: string, site: string): Promise<CMSBanner | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  /** DOM-Attribute, die der Renderer auf das Root der Default-Komponente spreaded. */
  getEditableProps(component: CMSComponent): HTMLAttributes<HTMLElement>;
  /** Einmalig im Layout gemountete React-Komponente (z.B. Storyblok Live-Preview-Bridge). null bei 'none'. */
  readonly BridgeScript: ComponentType | null;
}

// src/platform/services/cms/CmsAdapter.d.ts (SPI)
export interface CmsAdapter {
  readonly id: string;
  hasContent(): boolean;
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getBanner(locale: string, site: string): Promise<CMSBanner | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  /** OPTIONAL. Reine DOM-Attribute, KEIN Wrapper-Tag, KEIN React-Element. */
  getEditableProps?(component: CMSComponent): HTMLAttributes<HTMLElement>;
  /** OPTIONAL. Einmalig im Layout gemountet. */
  BridgeScript?: ComponentType;
}
```

---

## 5. Component-Map (CMS-agnostisch, App-Layer)

```typescript
// src/components/cms/component-map.ts
import { Hero, HeroSchema } from './hero';
import { QuickEntry, QuickEntrySchema } from './quick-entry';
// … weitere

export const cmsComponentMap = {
  hero:          { component: Hero,       schema: HeroSchema },
  'quick-entry': { component: QuickEntry, schema: QuickEntrySchema },
  // … alle ~17
} as const satisfies Record<string, { component: ComponentType<any>; schema: z.ZodSchema }>;

export type CmsComponentMap = typeof cmsComponentMap;
export type CmsComponentMapKey = keyof CmsComponentMap;
```

Wird im SSR-/Server-Container als ConstantValue gebunden:
`bind('CmsComponentMap').toConstantValue(cmsComponentMap)`.

**Per-Adapter CMS-Naming intern** (Variante B):
```typescript
@injectable('CmsAdapter:storyblok', 'Singleton')
class StoryblokCmsAdapter implements CmsAdapter {
  private static readonly NAMES: Record<CmsComponentMapKey, string> = {
    hero:          'hero',
    'quick-entry': 'quick_entry',
    // … fehlende Komponente = TS-Error
  };
  constructor(
    @inject('CmsComponentMap') private map: CmsComponentMap,
    @inject('StoryblokCmsApi')      private api: StoryblokCmsApi,
    @inject('LoggerService')        private logger: LoggerService,
  ) {}
}
```

---

## 6. Zod-Schemas (Single Source of Truth)

Pro Komponente ein Ordner:
```
src/components/cms/hero/
  ├── schema.ts        ← Zod-Schema + z.infer-Type. KEIN React-Import.
  ├── hero.tsx         ← React-Komponente. Importiert nur Type aus ./schema.
  ├── hero.test.tsx
  └── index.ts         ← Re-Export: { Hero, HeroSchema, type Hero }
```

```typescript
// src/components/cms/hero/schema.ts
import { z } from 'zod';

export const HeroSchema = z.object({
  id: z.string(),
  type: z.literal('hero'),
  headline: z.string(),
  text: TextEditorDataSchema,
  image: ImageRefSchema,
  main_button: z.array(ButtonDataSchema).optional(),
  video: z.array(VideoSchema).optional(),
});
export type Hero = z.infer<typeof HeroSchema>;
```

Discriminated Union global:
```typescript
export const CMSComponentSchema = z.discriminatedUnion('type', [
  HeroSchema, ButtonSchema, QuickEntrySchema, /* … */
]);
export type CMSComponent = z.infer<typeof CMSComponentSchema>;
```

**Konvention** (in `docs/cms-framework.md` festschreiben):
- `schema.ts` darf NUR `zod` + andere Schemas importieren — kein React/Tailwind/UI.
- Adapter importieren NUR `*/schema` (oder `*/index`-Re-Export der Schemas), niemals `*.tsx`-Files direkt.
- `src/components/cms/` ist ein **Hybrid-Modul** (UI-Renderer + Domain-Sprache). Explizit dokumentiert.
- Optionale Härtung: ESLint-Boundary-Regel (später).

---

## 7. Default-Komponenten-Vertrag

```typescript
type HeroProps = Hero & HTMLAttributes<HTMLDivElement>;

const Hero = ({ headline, text, image, main_button, video, type, id, ...rest }: HeroProps) => {
  return (
    <div {...rest} className={cn('…', rest.className)}>
      {/* …Komponenten-Inhalt… */}
    </div>
  );
};
```

**Pflichten**:
1. Prop-Signatur = `<Schema-Type> & HTMLAttributes<HTMLElement>`.
2. `...rest` aufs **einzige** Root-Element spreaden. Kein Fragment-Root.
3. `className` mit `cn(...)` mergen (damit Editable-Props nicht eigenes `className` überschreiben).

**Test pro Komponente**: rendert mit `data-test="x"` → Attribut landet auf Root-DOM-Element.

---

## 8. Renderer

```tsx
// src/components/cms/cms-component-renderer.tsx
export function CMSComponentRenderer({ components }: { components: CMSComponent[] }) {
  const cmsService = useCmsService();

  return (
    <>
      {components.map((c) => {
        const entry = cmsComponentMap[c.type];
        if (!entry) {
          logger.warn({ type: c.type }, 'Unknown CMS component type');
          return null;
        }
        const Component = entry.component;
        const editableProps = cmsService.getEditableProps(c);
        return <Component key={c.id} {...c} {...editableProps} />;
      })}
    </>
  );
}
```

Kein Switch, kein `cloneElement`, kein Wrapper-Tag.

---

## 9. DI-Bindings (depency.yml + injectables)

```yaml
Services:
  SearchService:  BatteryIncludedSearchService
  ProductService: EmporixProductService
  CMSService:     DelegatingCmsServiceSSR

Integrations:
  EmporixProductApi: EmporixProductApi
  StoryblokCmsApi:   StoryblokCmsApi
```

Plus zur Container-Init-Zeit:
- `bind('CmsComponentMap').toConstantValue(cmsComponentMap)` — Server + SSR.
- `CmsProviderResolver(env)` ermittelt `<id>` und macht `bind('CmsAdapter').toService('CmsAdapter:' + id)`.

---

## 10. ENV-Variablen

| Name | Default | Beschreibung |
|---|---|---|
| `NEXT_PUBLIC_CMS_PROVIDER` | `""` (auto) | `storyblok` \| `local` \| `none` \| `<custom>`. Leer = Token vorhanden → `storyblok`, sonst `none`. |
| `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` | `""` | wird **optional** (`OPTIONAL_ENV_VARS`, severity `warning`). |
| `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` | `"false"` | unverändert |
| `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` | `"true"` | unverändert |
| `NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE` | `"_default_"` | bisher hardcoded |

`REQUIRED_ENV_VARS` unverändert.

---

## 11. Per-Site-Theming (orthogonal zum CMS)

- Pro Site eine optionale CSS-Datei `src/app/styles/themes/<site>.css` mit Token-Overrides.
- `<SiteThemeStyle siteCode={…} />` (Server-Komponente) rendert `<link rel="stylesheet" href="/_next/static/themes/<site>.css">` falls vorhanden, sonst nichts.
- Default = Emporix-Theme (heutige `mapped.css`).
- Gilt für ALLE Komponenten (CMS-content UND logged-in-Components), weil Token-Variables global cascaden.

**Diese Story liefert**: den Hook + Default-Override-Datei + Beispiel-Theme. **Volltexturierung** späterer Story.

---

## 12. Migration / Rückwärtskompatibilität

- **Bestehende Storyblok-Deployments** (Token gesetzt): Resolver wählt `storyblok` automatisch. Visual Editor funktioniert weiter (Bridge-Script vom Adapter geliefert).
- **Bestehende Local-CMS-User**: setzen `NEXT_PUBLIC_CMS_PROVIDER=local`. JSON-Files unverändert.
- **Frisches Setup ohne Token**: Resolver wählt `none`, Home rendert leer. **AC #1 erfüllt**.

---

## 13. Test-Strategie

> Verfeinerung durch `testing-engineer` im Strategie-Modus. Aufriss:

**Akzeptanz / E2E** (`e2e/`):
- `cms-no-token.spec.ts` — App startet & rendert Home ohne Token. **AC #1**.
- `cms-storyblok-flow.spec.ts` — Mit Token: Storyblok-Story wird gerendert.
- `cms-local-flow.spec.ts` — Mit `CMS_PROVIDER=local`: JSON-Content wird gerendert.

**Adapter-Contract-Test** (zentral, läuft gegen alle 3 Adapter):
- `CmsAdapter.contract.test.ts` — gleiches Set Assertions × N Adapter-Impls.

**Unit** (Jest):
- `CmsProviderResolver.test.ts` — Env-Matrix.
- `DelegatingCmsServiceSSR.test.ts` — Delegation, Edge-Cases.
- `StoryblokCmsMapper.test.ts` — Storyblok-Struktur → Domain-Modell, Validation-Fehler.
- `env-validation.test.ts` — Token-Absenz produziert KEIN `hasErrors`.

**Component / RTL**:
- Pro Default-Komponente: Test "spreaded `data-test`-Attribut aufs Root-DOM-Element".
- `cms-component-renderer.test.tsx` — Map-Lookup, unbekannter Typ → null + Warn-Log.

**API-Route**:
- `api/cms/banner/route.test.ts` — gibt 204 wenn Provider=none, Daten sonst.

---

## 14. Akzeptanzkriterien & Hand-off

- [ ] **AC #1**: `npm run build && npm start` ohne `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` läuft, Home rendert, kein Module-Load-Crash.
- [ ] **AC #2.a**: `CmsAdapter`-SPI dokumentiert; neuer Adapter additiv ohne Core-Änderung möglich.
- [ ] **AC #2.b**: UI-Layer (`src/components/`, `src/app/`, `src/hooks/`) enthält keinen `@storyblok/*`-Import mehr.
- [ ] **AC #2.c**: Kein zusätzlicher Wrapper-`<div>` durch CMS-Adapter. Alle Default-Komponenten spreaden `...rest`.
- [ ] **AC #2.d**: Per-Site-Theme-Hook integriert, Default = Emporix.
- [ ] **AC #2.e**: `docs/styling-and-theming.md` mit Per-Site-Theming-Abschnitt.
- [ ] **Framework-Doku**: `docs/cms-framework.md` mit Adapter-Anleitung + Diagramm.
- [ ] Storyblok Visual-Editor funktioniert unverändert (Live-Preview Smoke-Test).
- [ ] Alle Tests grün; `npm run verify:client-chunks` ok.

**Hand-off-Reihenfolge**:
1. → `testing-engineer` (Strategie-Modus): Test-Files-Liste, Adapter-Contract-Test definieren.
2. → `testing-engineer` (Pre-Implementation): Failing Akzeptanz-Tests committen.
3. → `frontend-developer` (Build-Modus): Implementierung gemäß diesem Plan.
4. → Cross-Review: `architect` (Architektur) + `testing-engineer` (Tests).

---

## 15. Decision Log (Architektur-Entscheidungen)

| # | Entscheidung | Begründung |
|---|---|---|
| 1 | Facade-Pattern (`CMSService`) + Plugin-Adapter-SPI (`CmsAdapter`) | App spricht nur eine Sprache; neue CMS sind additive Plugins |
| 2 | Eine Service-Impl (`DelegatingCmsService`), N Adapter-Impls | Service kapselt nur Delegation; Adapter sind die Plugins |
| 3 | Component-Map ist CMS-agnostisch, lebt im App-Layer | Open-Closed: Map enthält keine CMS-Aliasen |
| 4 | CMS-Naming pro Adapter intern (statische `NAMES`-Map, TS-constrained) | Open-Closed: neuer Adapter = neuer Ordner, kein Core-Edit; fehlende Komponente = Compile-Error |
| 5 | Per-Komponente-Ordner unter `src/components/cms/<name>/` | Co-location: Schema + Component zusammen |
| 6 | `schema.ts` ist React-frei; Adapter importieren nur Schemas, nie Components | Schichten-Reinheit trotz Co-location |
| 7 | Zod als Single Source of Truth, Types via `z.infer`; `z.discriminatedUnion` | Eine Definition pro Komponente; Adapter-Mapper validieren am Boundary |
| 8 | Editable-Props-Vertrag: `HTMLAttributes<HTMLElement>` | Reine DOM-Attribute decken alle bekannten CMS-Bridges ab |
| 9 | Default-Komponenten spreaden `...rest` aufs Root, kein Wrapper-Tag | Sauberes DOM, kein überflüssiges `<div>` |
| 10 | Bridge-Script optional pro Adapter, einmalig im Layout | Storyblok Visual Editor bleibt erhalten |
| 11 | `NullCmsAdapter` als Fallback bei fehlender Konfiguration | AC #1 ohne Spezial-Code im Service |
| 12 | Per-Site-Theming orthogonal zum CMS | Auch eine `none`-CMS-Site darf eigenes Theme haben |
| 13 | Banner & Navigation via `/api/cms/*`-Routes | Browser sieht nie ein CMS-SDK |
| 14 | Doku: `docs/cms-framework.md` neu, plus `local-cms.md` / `styling-and-theming.md` / `storyblok-integration.md` aktualisiert | Adapter-Erweiterung für Pre-Sales nachvollziehbar |
| 15 | ESLint-Boundary-Regel optional, Konvention reicht initial | YAGNI; bei Schichten-Verstößen später nachschärfen |

---

## Anhang: Konventionen für Folgesessionen

- **Kerndatei dieses Plans**: `.claude/SHOW-323-plan.md`.
- **Adapter-Vertrag**: `src/platform/services/cms/CmsAdapter.d.ts`.
- **App-Map**: `src/components/cms/component-map.ts` (CMS-agnostisch).
- **Adapter-CMS-Naming**: statische `NAMES`-Map im Adapter, type-constrained gegen `CmsComponentMapKey`.
- **Schemas leben mit der Komponente**: `src/components/cms/<name>/schema.ts`, React-frei.
- **Adapter darf `*/schema` importieren, niemals `*.tsx`-Files**.
- **Renderer nutzt `cmsComponentMap` direkt** (kein Switch, keine separate Map).
- **Editable-Props sind `HTMLAttributes<HTMLElement>`** — keine React-Elemente, keine Wrapper-Tags.

---

## 16. Vertical Slices

Aufgabe wird in **7 vertikale Slices** geteilt. Jeder Slice ist eigenständig:
- lauffähig (`npm run build && npm start` grün)
- testbar (eigene Unit/Integration/E2E-Tests)
- Quality-Gates-konform (TS-strict, ESLint, Jest, Playwright, `verify:client-chunks`)
- deploybar ohne Folge-Slice (Backward-Compat bleibt jederzeit erhalten)

### Slice 1 — Adapter-Framework + NullAdapter (AC #1)

**Goal**: App startet ohne `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`. Adapter-Pattern als Skelett etabliert.

**Scope**: `CMSService`-Interface erweitert, `CmsAdapter`-SPI, `DelegatingCmsServiceSSR`, `CmsProviderResolver`, `NullCmsAdapter`, DI-Bindings, Lazy-Init für Storyblok (in `src/lib/storyblok.ts`), Token-Guard in Pages, ENV-Defaults, Healthcheck (Storyblok → optional).

**Out-of-Scope**: StoryblokAdapter (kommt in Slice 4), Schema-Refactor, Renderer-Umbau, Theming, Banner-API.

**Tests**: E2E `cms-no-token.spec.ts`, Unit (`CmsProviderResolver`, `NullCmsAdapter`, `DelegatingCmsServiceSSR`, `env-validation`).

**Risiko**: niedrig. Storyblok-Nutzer-Flow bleibt bit-identisch.

**Wert**: AC #1 erfüllt.

### Slice 2 — Default-Komponenten-Foundation (Zod + HTMLAttributes-Spread)

**Goal**: Foundation für CMS-Default-Komponenten etabliert. 5 Pilot-Komponenten (`button`, `hero`, `content-block`, `richtext`, `page`) in Co-Location-Pattern (`<name>/{schema.ts, <name>.tsx, <name>.test.tsx, index.ts}`) mit Zod-Schemas + `HTMLAttributes`-Spread. Component Map (`cmsComponentMap`) + Discriminated Union (`CMSComponentSchema`) als Foundation. Dead-Code-Cleanup aus Slice 1 (`LocalCMSServiceSSR`, `cms/local/`).

**Scope**: Component Map Foundation, Discriminated Union (Slice-3-erweiterbar), 5 Pilot-Komponenten, Domain-Type `CMSComponent` re-exportiert aus `component-schema.ts`. `richtext` mit semantischem Block-AST (CMS-agnostisch, kein TipTap-Naming). `page` mit `z.lazy()`-Recursion + Children-via-Props-Rendering (statt body[]-Iteration).

**Out-of-Scope**: Restliche 15 Default-Komponenten → Slice 3. Renderer-Map-Erweiterung → Slice 4 (StoryblokAdapter). Storyblok-Wrapper-Komponenten löschen → Slice 4.

**Tests**: Pro Pilot RTL "spread `data-testid` auf Root" + Schema-Parse + className-Merge. Foundation: `component-map.test.ts` Drift-Guard + Schema-Identity-Match; `component-schema.test.ts` Smoke; `page/schema.import.test.ts` Init-Order-Regression-Guard.

**Risiko**: mittel — `PageSchema`-Recursion mit `z.lazy()` braucht Side-Effect-Import-Pattern (in `page/index.ts` dokumentiert).

**Wert**: Foundation steht, Pattern auf 5 Pilot exemplifiziert, App läuft im Walking-Skeleton-Zustand weiter. AC #2.a "neuer CMS-Adapter additiv ohne Core-Änderung" hat strukturelle Basis.


### Slice 3 — Restliche Default-Komponenten (Walking-Skeleton-Vervollständigung)

**Goal**: 15 verbleibende CMS-Komponenten auf das in Slice 2 etablierte Co-Location-Pattern + Component-Map-Registry migrieren. Default-Komponenten-Foundation ist damit komplett (alle 20 in der Map).

**Scope**: `article, category, column-teaser, columns, feature, grid, logo, media-text, navigation, quick-entry, recommendations, segment, teaser, top-banner-announcement, video` — jeweils `<name>/{schema.ts, <name>.tsx, <name>.test.tsx, index.ts}` + Eintrag in `cmsComponentMap` + Schema in `CMSComponentSchema`. Plus: Type-Cleanups aus Slice-2-Cross-Review (`HeroVideoSchema`-Cast entfernen, `TextEditorData` aus `hero/schema` nach `_shared/` rauslösen, Button-Klassen ggf. ausbauen).

**`article`-Sonderfall**: nutzt heute `<RichtextStoryblok>`-Bridge (Slice-2-Hotfix `72c3424`), weil Storyblok-TipTap-Daten nicht direkt vom semantischen `<Richtext>`-AST konsumiert werden können. In Slice 3 bleibt das so — Article zieht nur ins Co-Location-Layout, **behält** `<RichtextStoryblok>` bis Slice 4 den TipTap→AST-Mapper im Adapter liefert.

**`'use client'`-Audit**: bei Migration jeder Komponente prüfen, ob `'use client'` wirklich nötig (gemäß Pattern A — Decision 21). 13 von 15 haben heute `'use client'` ohne Client-API-Vorkommen — diese werden Server-Components. `media-text` (1 Client-Indikator) und `richtext-storyblok` (Bridge, bleibt Client) sind die Ausnahmen.

**Out-of-Scope**: Storyblok-Wrapper löschen (Slice 4). Layout-Page-Konzept (Slice 5). Article-RichText-Migration auf agnostische `<Richtext>` (Slice 4).

**Tests**: Pro Komponente RTL-Spread + Schema-Parse-Tests. Drift-Guard erweitert automatisch.

**Risiko**: niedrig — Pattern ist erprobt, Container-Recursion (`columns`, `grid`) folgt dem `z.lazy()`-Side-Effect-Import-Pattern aus Slice 2.

**Wert**: Default-Komponenten-Pool vollständig CMS-agnostisch und Adapter-ready.

### Slice 4 — StoryblokAdapter (Storyblok hinter das Framework)


_Nummerierungs-Hinweis: der ursprüngliche Slice 4 (LocalJsonAdapter) entfiel — LocalJsonAdapter wurde bereits in Slice 1 + 2 vollständig erledigt; StoryblokAdapter ist auf den freien Slot 4 gerutscht._

**Goal**: Storyblok-Pages laufen durch `CMSService → StoryblokCmsAdapter`. UI-Layer hat keinen `@storyblok/*`-Import mehr.

**Scope**: `StoryblokCmsApi`, `StoryblokCmsAdapter`, `StoryblokCmsMapper`, `StoryblokBridgeScript`. `cms-page.tsx` (agnostisch), Map-basierter Renderer, Pages umgestellt. Löschen: `src/lib/storyblok.ts` (heute `.tsx` mit Wrapper-Adaptern), `StoryblokProvider.tsx`, `src/components/cms/storyblok/`.

**`StoryblokCmsMapper`-Detail**: enthält explizit einen **TipTap-→-semantischer-AST-Mapper** für Rich-Text-Felder (~30-50 Zeilen). Wandelt Storyblok-`StoryblokRichTextNode` in unsere `RichtextData`-Form (siehe Slice-2-Plan §8 + Domain `richtext/schema.ts`).

**Article-RichText-Migration**: Article (in Slice 3 ins Co-Location-Layout migriert, behielt aber `<RichtextStoryblok>`) wird auf die agnostische `<Richtext>` umgestellt — die TipTap-Konvertierung passiert jetzt im Adapter-Mapper, nicht mehr in einer UI-Bridge.

**Löschen**: zusätzlich zu den oben gelisteten Files: `src/components/cms/richtext-storyblok.tsx` (Übergangs-Bridge aus Slice-2-Hotfix `72c3424` — nicht mehr nötig, sobald Article migriert ist).

**Tests**: E2E `cms-storyblok-flow.spec.ts`, Visual-Editor-Smoke-Test, Adapter-Contract-Test, `StoryblokCmsMapper.test.ts` (inkl. TipTap-→-AST-Konvertierung pro Block-Kind + Inline-Kind), Article-Render-Test gegen die neue AST-Form.

**Risiko**: hoch (großer Umbau, Visual Editor muss weiter laufen, TipTap-Mapping muss alle in Storyblok genutzten Node-Typen abdecken).

**Wert**: AC #2.b, AC #2.c. Endzustand für Storyblok-Pipeline.


### Slice 5 — Layout-Konzept (`getLayout` + `CMSLayout` + Banner-Migration)

**Goal**: Layout als erste-Klasse-Konzept einführen. `CMSService.getLayout(layoutId, locale, site)`. `ContentSlot` als reguläre Komponente im Schema. Layout-Auswahl datengetrieben via Page-Feld `layoutId` mit Default-Fallback. Banner ist die erste Komponente, die als Layout-Komponente migriert wird (deferred aus Slice 3 Variante T).

**Scope**:
- **Service/SPI-Erweiterung** (siehe §4): `getLayout(layoutId, locale, site): Promise<CMSLayout | CMSNoResult>` in `CMSService` + `CmsAdapter`.
- **Neuer Domain-Type** `CMSLayout = { id: string; components: CMSComponent[] }` (schlank, kein Title/URL — eigener Type, nicht `= CMSPage`).
- **Schema-Validierung**: `CMSLayoutSchema` enforced "**genau ein `content-slot` pro Layout**" (kein Multi-Slot — Decision 29).
- **Page-Schema-Erweiterung**: optionales `layoutId?: string` in `CMSPage` (Pre-Sales-Editor kann pro Page überschreiben).
- **ContentSlot-Komponente**: reguläre Default-Komponente in `cmsComponentMap` (`src/components/cms/content-slot/`). Schema, Spread-Vertrag, Test — wie alle anderen. Renderer behandelt sie speziell: ersetzt mit Page-Content.
- **Layout-Auswahl-Mechanik (Hybrid M3)**: Page-Route lädt sequentiell — erst `getPage()`, dann `getLayout(page.layoutId ?? 'default')`. Fallback bei Layout-`CMSNoResult`: Default-Layout.
- **Banner-Migration**: `top-banner-announcement` ins Co-Location-Layout (war in Slice 3 deferred — Variante T). Banner wird Layout-Komponente, `useBanner.ts`-Hook wird aufgelöst (Daten kommen über Layout-Page-Body).
- **Layout-Cache**: `globalThis`-Cache pro `(layoutId, locale, site)`-Schlüssel mit **5-10 Min TTL** (länger als der Slice-1-Public-Token-Cache; Layouts ändern sich selten). Konfigurierbar via ENV (`NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS`). Webhook-Invalidation kommt in Slice 7.
- **Adapter-Implementierungen**: `getLayout` in `NullCmsAdapter`, `LocalJsonCmsAdapter`, `StoryblokCmsAdapter` (Slug-Convention `_layouts_/<layoutId>`).

**Caller-Anpassungen**:
- App-Route-Page-Component (`app/[site]/[locale]/(default)/[...slug]/page.tsx` und Pendants) — lädt Page, dann Layout, komponiert via `LayoutRenderer` mit Page-Content im `ContentSlot`.
- App-Layout-Hierarchie (`app/[site]/[locale]/layout.tsx`) bleibt **App-Shell** (NextIntl, Provider, Site-Resolution). Kein CMS-Layout drin.

**Tests**: Adapter-Contract-Test erweitert um `getLayout`-Vertrag (jeder Adapter liefert `CMSLayout` oder `CMSNoResult`; nie throws). Layout-Schema-Validierung (genau ein ContentSlot). Layout-Cache-Verhalten (TTL + Schlüssel-Trennung). E2E: Page-mit-Default-Layout, Page-mit-Override-Layout, Page-mit-nicht-existentem-Layout (Fallback auf Default).

**Risiko**: mittel — Architektur-Erweiterung mit Schema-Touch (`CMSPage.layoutId`), Cross-Schicht-Touch (App-Route + Service + Adapter). Layout-Cache-Konfiguration muss sinnvoll defaulten.

**Wert**: AC #2.b komplett (Browser hat keinen direkten CMS-SDK-Call mehr). Plus: Multi-Layout-Support per Page-Override; globale Komponenten haben sauberen Erweiterungspfad (Footer-Promo, Maintenance-Hinweis, etc. additiv ohne Schema-Touch).

### Slice 6 — Per-Site-Theming

**Goal**: Pro Site eigenes CSS-Override-File möglich.

**Scope**: `src/app/styles/themes/_default_.css`, `<SiteThemeStyle />`, `layout.tsx`-Integration, Beispiel-Theme für eine Demo-Site, `docs/styling-and-theming.md` erweitert.

**Tests**: `SiteThemeStyle` RTL, E2E "Site-Switch ändert Primary".

**Risiko**: niedrig.

**Wert**: AC #2.d, AC #2.e.

### Slice 7 — Webhook-Cache-Invalidation

**Goal**: On-Demand-Cache-Invalidation via Webhook-Endpoint. CMS-Editor publishet Änderung → Webhook trifft App → relevante Caches sind sofort frisch (statt TTL-Wartezeit).

**Scope**:
- **API-Route** `src/app/api/cms/webhook/route.ts` — empfängt Webhook-POST (Payload-Form abhängig vom CMS — Storyblok `story_id`/`action`; Local-CMS: nicht relevant; Contentful: anderes Format). Authentifizierung via Webhook-Secret aus ENV (`NEXT_CMS_WEBHOOK_SECRET`).
- **Invalidation-Strategy**:
  - `revalidateTag('cms-page')` für alle Page-Caches
  - `revalidateTag('cms-layout')` für alle Layout-Caches
  - Optional: granular per Slug — `revalidateTag(`cms-page:${slug}`)` falls Webhook-Payload den Slug enthält
  - In-Memory-Caches (`globalThis`-Cache aus Slice 1 + Slice 5) zusätzlich räumen
- **Tag-Konvention im Code**: `getPage`/`getLayout`-Implementierungen taggen ihre Next-fetch-Cache-Einträge mit `cms-page`/`cms-layout` (+ ggf. slug/id).
- **CMS-Setup-Doku**: in `docs/cms-framework.md` (Slice 8) wird beschrieben, wie der Webhook im jeweiligen CMS konfiguriert wird (Storyblok-Webhook-Settings, Contentful-Webhook-Konfig, etc.).

**Tests**: Unit-Test für Webhook-Endpoint (Auth, Payload-Parsing, `revalidateTag`-Aufrufe). Integration-Test für Cache-Invalidation-Pfad (gemockter Cache, Webhook-Trigger, Cache-State-Verification).

**Risiko**: niedrig-mittel — Architektur klar, aber Webhook-Auth + idempotente Invalidation müssen sauber sein.

**Wert**: Layout/Page-Cache-TTL kann von Minuten auf Stunden hochgezogen werden, Editor-Veröffentlichungs-Latenz fällt auf Sekunden. AC #2.f (war im ursprünglichen Plan nicht spezifiziert — wird durch Slice 7 etabliert).

### Slice 8 — Framework-Doku + Polish

**Goal**: Adapter-Erweiterung für Pre-Sales nachvollziehbar; Architektur-Conventions aus den Slices 1-7 in dauerhafte Doku überführen.

**Scope**:
- `docs/cms-framework.md` (NEU) — Adapter-Pattern, Component-Map, Co-Location-Konvention, Naming-Konvention (HeroData/HeroProps/Hero), Pattern A / A.2 (Server-Default + Client-Insel mit Context-Provider).
- `docs/cms-framework.md` enthält das **Init-Order-Pattern** (Side-Effect-Import in `<container>/index.ts` für rekursive Schemas mit `z.lazy()`) — Decision 19. Inklusive Hinweis, dass jeder Container-Komponenten-Slot (`page`, `columns`, `grid`) dasselbe Pattern braucht.
- `docs/cms-framework.md` enthält das **Layout-Konzept** aus Slice 5 (`getLayout`, `CMSLayout`, `ContentSlot`, Hybrid-Auswahl via `page.layoutId`).
- `docs/cms-framework.md` enthält das **Webhook-Cache-Invalidation-Setup** aus Slice 7 (CMS-spezifische Konfig-Anleitungen).
- `docs/local-cms.md` aktualisiert (Adapter-Pattern, `LocalJsonCmsAdapter` mit `CmsDataLoader`-Strategy, Layout-Files-Konvention).
- `docs/storyblok-integration.md` aktualisiert (Storyblok als Adapter-Beispiel, TipTap-→-AST-Mapper, Bridge-Script, `_layouts_/<id>`-Story-Konvention).
- `docs/styling-and-theming.md` Per-Site-Theming-Abschnitt finalisieren (Slice-6-Stand).
- `.env.template` final (alle SHOW-323-ENVs sauber gegen aktuellen Stand abgleichen).
- ADRs (siehe ADR-Tracking-Bereich falls etabliert).
- Release-Notes / CHANGELOG-Eintrag.

**Tests**: Markdown-Lint. Plus: prüfen dass alle Code-Snippets in der Doku tatsächlich gegen die finalen Interfaces compilieren (Stichproben).

**Risiko**: trivial.

**Wert**: Adapter-Erweiterungspfad und Codebase-Conventions dauerhaft dokumentiert — externe Entwickler (Pre-Sales-Team, neue Adapter-Autoren) können autark arbeiten.

### Reihenfolge

```
1 (AC#1) → 2 (Foundation + 5 Pilot) → 3 (Restliche 15 + Cleanups) → 4 (Storyblok hinter Adapter) → 5 (Banner) → 6 (Theming) → 7 (Doku)
```

Begründungen:
- **Slice 1 zuerst** weil AC #1 das einzige blockende Akzeptanzkriterium ist.
- **Slice 2 + 3 vor 4** weil der Map-basierte Renderer (Slice 4) Schemas aus 2 + 3 braucht (Vollständigkeit der Component Map).
- **Slice 5 + 6 nach 4** weil orthogonal — Reihenfolge austauschbar.
- **Slice 7 zum Schluss** weil Doku auf gefestigtem Stand basieren soll.
- **Ursprünglich geplanter Slice "LocalJsonAdapter"** entfiel — bereits in Slice 1 + 2 durchgeführt. StoryblokAdapter ist auf Slot 4 gerutscht; Slice 5/6/7 behalten ihre Nummern.


### Risiko-Übersicht

| Slice | Hauptrisiko | Mitigation |
|---|---|---|
| 1 | `null`-Returns in heutigen Pages ungetestet | E2E-Baseline vor Implementierung |
| 2 | Storyblok-Wrapper brechen durch Spread-Refactor; `PageSchema`-Recursion bei `z.lazy()` | Storyblok-E2E grün halten; Init-Order-Side-Effect-Import in `page/index.ts` (siehe §17.5) |
| 3 | Container-Recursion in `columns`/`grid` wiederholt das Init-Order-Pattern unkommentiert | Convention aus Slice 2 in `docs/cms-framework.md` festhalten (Slice 7) bzw. lokal kommentieren |
| 4 | Visual Editor stirbt während Storyblok-Adapter-Migration | Manueller Browser-Smoke vor Push; Bridge-Script-Vertrag im SPI |
| 5 | Layout-Page-Konzept ist Architektur-Erweiterung mit Cross-Schicht-Touch | Klare Adapter-API für `getPage('_layout_', …)` plus Layout-Render-Pfad-Test |
| 6 | FOUC durch Theme-Override | `<link>` im `<head>`, kein dynamic-import |
| 7 | — | — |


---

## 17. Post-CR-Update (PR #1 Cleanup) — Stand 2026-05-15

Aus dem CR zu Slice 1 ergaben sich folgende **architektonische Korrekturen am Master-Plan**:

### 17.1 Banner ist eine CMS-Komponente, kein Service-Sonderfall

**Status**: in Slice 1 Cleanup-Commits (`cedf7de..081f522`) bereits umgesetzt.

- `getBanner` ist aus `CMSService` und `CmsAdapter` **entfernt**. §4 (Interfaces) gilt damit ohne diese Methode.
- `CMSBanner`-Domain-Type ist **gelöscht**.
- Die in §4 weiter oben dokumentierten Interface-Snippets sind insofern überholt — neue Wahrheit: kein `getBanner`, keine `CMSBanner`. `getNavigation` und `CMSNavigation` bleiben (Adapter liefert Navigationsbaum als legitimes Daten-Konstrukt).

### 17.2 Provider-IDs zentralisiert

`CMS_PROVIDER_IDS` (`as const`-Array) + `CmsProviderId`-Type ist in `src/platform/services/cms/CmsProviderResolver.ts` exportiert. Neuer Adapter braucht einen Eintrag in dieser Konstante, alles andere ist via TypeScript constrained.

### 17.3 Slice 5 — Plan-Update

**Vorher** (§16 Slice 5): "Banner via API-Route. `/api/cms/banner` ruft `CMSService.getBanner()`."

**Neu**: Banner wird als CMS-Komponente in einer **Layout-Page** modelliert.

Konkret:
- `BannerSchema` + Banner-Komponente in der Component-Map (Slice 2 nimmt die Foundation, Banner-Schema kann hier gleich mitgenommen werden).
- Layout-Page-Konzept: `getPage('_layout_', locale, site)` (oder ähnlich) liefert eine `CMSPage` mit globalen Komponenten (Banner, Footer-Promo, etc.).
- `use-banner.ts`-Hook wird auflösbar oder verlagert sich in den Layout-Render-Pfad.
- **Keine eigene API-Route** für Banner nötig — Layout-Page-Fetch ist Server-Component-Render.

Damit verschiebt sich Slice 5 inhaltlich von "Banner-API-Route" auf "Layout-Page-Konzept + Banner-Komponente". Footprint vergleichbar, Architektur sauberer.

### 17.4 LocalCmsServiceSSR — Löschung in Slice 2

Cross-Review-Finding M2: Die tote Klasse `src/platform/services/cms/impl/LocalCMSServiceSSR.ts` (kein `@injectable`, providerId='local'-Konflikt mit dem echten LocalJsonCmsAdapter) sollte in **Slice 2** gelöscht werden, nicht erst im ursprünglich geplanten Slice 4 (entfallen). Auch `src/components/cms/local/local-cms-page.tsx` fällt mit.

§16 ehemaliger Slice 4-Slot wird damit entsprechend leichter — er konzentriert sich auf das Migrieren der Local-Routing-Komponenten.

### 17.5 Decision Log (Ergänzung zu §15)

| # | Entscheidung | Begründung |
|---|---|---|
| 16 | Banner ist eine CMS-Komponente, kein Adapter-Sonderfall | Konsistenz: globale UI-Blöcke folgen der Component-Pipeline |
| 17 | Adapter-IDs zentralisiert in `CMS_PROVIDER_IDS as const` | Neuer Adapter = ein Eintrag, TypeScript erzwingt Konsistenz |
| 18 | Code-Kommentare nennen weder Story-IDs noch interne Slice-Begriffe noch Plan-File-Pfade | Code-Lebensdauer ist länger als Story-Kontext; `.claude/` ist nicht committed |
| 19 | Container-Komponenten mit `z.lazy(() => CMSComponentSchema)` brauchen Side-Effect-Import auf `component-schema` im `<name>/index.ts` | Verhindert TDZ-Errors beim Modul-Load. Pattern erstmals in Slice 2 `page/index.ts` etabliert; in Slice 3 (`columns`, `grid`) wiederzuverwenden. Dokumentation in `docs/cms-framework.md` (Slice 7). |
| 20 | Slice 2 als Walking Skeleton (5 Pilot + Foundation) — restliche 15 Komponenten in Slice 3 | Pattern erst pilotieren, dann skalieren. Sauberer Slice-Abschluss-Kriterium: alle Tests grün + Browser-Smoke + Feature funktioniert. |
| 21 | **Pattern A**: CMS-Default-Komponenten sind **Server Components by default**. `'use client'` ist nur erlaubt, wenn echte Browser-API/Hook/Event-Logic gebraucht wird. In diesem Fall wird die Client-Logic in eine separate Sub-Komponente extrahiert (`<name>/<name>-<feature>.tsx` mit `'use client'`), die vom Server-Parent eingebettet wird. | SSR-Default schont Bundle und nutzt App-Router-Strengths. Refactoring muss **Verhalten 1:1 erhalten** — kein Eliminieren von Conditional-Rendering, Hooks oder Edge-Cases als "Vereinfachung". |
| 22 | **Pattern A.2** (Multi-Insel): Bei Komponenten mit **mehreren** Client-Inseln, die gemeinsamen State teilen, nutzen die Inseln einen gemeinsamen Context-Provider. Server-Parent komponiert die Insel-Pieces (Provider, Surface, Toggle, …). | Vermeidet Hoist-State-Up-Antipattern bei verteilten Client-Inseln. Beispiel: Hero mit breakpoint-abhängigem SVG + Video-Toggle teilt `isPlaying` und `isAboveSmallScreen` per Context. |
| 23 | **Cross-Review auf kompletten Change zu `main`**, nicht inkrementelle Patches. Architect-Diff-Inspektion umfasst das gesamte Slice-Diff-Set inkl. indirekt geänderter Files (Caller, Type-Konsumenten, nicht-migrierte Komponenten, deren Imports/Verhalten berührt sind). Reviewer-Behauptungen über "Status quo" werden via `git diff main..HEAD -- <file>` verifiziert, nicht passiv akzeptiert. Gilt für architect und testing-engineer. | Slice-2-Vorfall (`article.tsx` `RichText` → `renderRichText` durch Engineer-Workaround) wurde nicht gefangen, weil Diff nur die 5 Pilot-Files prüfte und testing-engineer-Befund "war eh so" nicht verifiziert wurde. |
| 24 | **Stop-and-Ask in beiden Agenten** (`frontend-developer` und `architect`). Bei Plan-Lücken, Trade-offs, Verhaltensänderungen, Compile-Konflikten mit Out-of-Scope-Komponenten oder Architektur-Erweiterungen: anhalten, **User konsultieren** (nicht einen anderen Agenten), gemeinsam entscheiden, dann weitermachen. Plan-Vollständigkeit ist **nicht** Vorbedingung — neue Erkenntnisse während Implementation sind normal und erlaubt. Reaktion auf Lücken ist der Hebel. Code-Kommentare zur Rechtfertigung sind **kein Ersatz** für die Rückfrage. | Robuster als Plan-Vollständigkeit zu erzwingen; respektiert Implementations-Realität, kanalisiert aber Trade-offs durch User-Entscheidung statt Engineer-Pragmatik. |
| 25 | **Briefing-Template-Pflicht**: jeder Agent-Call (frontend-developer, testing-engineer) bekommt eine **"Verhalten-Constraints"**-Sektion mit erlaubten vs. nicht-erlaubten Änderungen und expliziter Stop-and-Ask-Regel. Architect inkludiert ein **Pre-Audit-Schritt** (`git grep` der Caller und Type-Konsumenten) und ein **Post-Implementation-Diff-Audit** vor Status-Bericht. | Verhindert, dass die Regeln 23+24 als implizit angenommen werden — wiederholtes Verankern im Briefing macht sie operativ. |
| 26 | **Quality-Gate-Vertrag exakt**: jeder Slice-Abschluss und jeder Push verlangt **grünes `npm test`** (das vollständige Pipeline-Skript, nicht einzelne Sub-Skripte). Engineer-Berichte mit "pre-existing-rot" werden vom Architect via `git stash`-Probe + Re-Run auf `main` verifiziert. Wenn ein Pre-Existing-Issue tatsächlich `npm test` rot hält: **erst fixen oder Gate mit User-Approval explizit downgraden**, nicht implizit ignorieren. | Slice-1 + Slice-2 hatten `npm run jest` grün, aber `npm test` rot (`e2e`-Teil scheiterte an fehlender `playwright.config.ts` → Playwright lädt 110 Jest-Files). Mehrfach committed mit rotem Gate, weil "pre-existing" akzeptiert wurde — direkter Verstoß gegen Commit-Policy. |
| 27 | **Slice-Start-Bedingung**: bevor neuer Slice gestartet wird, läuft `npm test` auf der aktuellen Branch-Basis. Wenn rot, ist Gate-Fix die **erste Aufgabe**, nicht Feature-Arbeit. | Verhindert, dass auf rotem Untergrund weitergebaut wird. |
| 28 | **Review-Pflicht differenziert nach Größe**:<br>**Kleine Änderungen** (z. B. einzelner Mini-Patch, klar isoliert, ≤1 File mit wenigen Zeilen): **Architect-Review reicht**. Pflicht-Steps: (a) `git show <sha>` Diff-Audit gegen Engineer-Bericht, (b) Tests-grün-Verifikation (eigenes `npm run jest` oder `npm test`).<br>**Slice-Abschlüsse und größere Sachen** (Refactorings, Multi-File-Changes, neue Features, Architektur-Eingriffe): **Cross-Review im Gesamtkontext gegen `main`**. Architect-Diff-Audit (`git diff master..HEAD`) **plus** `testing-engineer`-Cross-Review (vollständige Slice-Sicht, nicht inkrementelle Patches). Erst danach Push.<br>**Engineer-Selbstbericht ersetzt nie den eigenständigen Review** — auch bei Mini-Patches. | Differenziert nach Aufwand-Realität: kleine Änderungen brauchen keinen vollen Cross-Review-Cycle, aber **immer** mindestens ein Architect-Review. Slice-2-Mini-Patch (`2236ae2`-Vorfall) zeigte: Architect hat passiv akzeptiert statt selbst zu prüfen — das ist auch bei Mini-Patches nicht akzeptabel. |
| 29 | **Module-Subgraph-Trigger-Pattern**: Pattern-A-Inseln, die nur einen Client-Komponenten importieren (z. B. `Link` aus `@/i18n/navigation`) und sonst keine eigenen Hooks/Browser-API/Event-Handler haben, brauchen `'use client'` **wenn kein anderer Konsument auf dem Pfad bereits `'use client'` ist**. Grund: `@/i18n/navigation.ts` ruft beim Module-Load `createNavigation()` mit `'use client'`-Default-Export auf — der Factory-Call ist nur in einem Client-Subgraph legal. Konkrete Audit-Checkliste in `.claude/agent-memory/architect/feedback_use_client_audit.md`. | Slice-3-PR #3 deckte einen systemischen Audit-Fehler auf: 6 Pattern-A-Inseln (article-product-link, category-link, column-teaser-image, content-block-button, quick-entry-element, navigation-item) wurden in Cross-Review-Iteration 1 als "redundant `'use client'`" markiert und entfernt → Build crashte. Restore + Subgraph-Trigger-Begründung in JSDoc. User-Anmerkung im PR-Review fing den Fehler. |
| 30 | **Approve = 0 Findings (strict)**: Egal wer reviewed (Architect, testing-engineer, frontend-developer, User), egal welche Severity. "PASS mit Caveat", "Approve with fix blockers", "minor reicht für Push" oder "Follow-up für aktuell-fixbare Findings" sind **verbotene Kategorien**. Iteration N+1 läuft nur, wenn Iteration N nicht 0 Findings hatte. FU-Stories sind weiterhin legitim für **Architektur-Erweiterungen**, die einen neuen Slice eröffnen würden — nicht für Findings, die im laufenden Slice fixbar sind. | Slice-3-Verlauf zeigte: "PASS mit drei Minors + vier Nits als Follow-up" akkumuliert Findings, die nie gefixt werden. Findings, die im Slice fixbar sind, MÜSSEN dort gefixt werden. Memory: `feedback_cross_review_discipline.md`. |
| 31 | **10 Quality Gates pro Slice + Pro-Slice-Ablauf ohne User-CR**: ab Slice 4 läuft jeder Slice durch die 10 verbindlichen Quality Gates (siehe `.claude/agent-memory/architect/feedback_quality_gates_per_slice.md`). Architect verifiziert Gates 1-4 + 5 + 9 eigenständig per Bash. testing-engineer verifiziert Gates 5 (doppelt) + 6 + 7 + 8. Beide laufen Cross-Review parallel unter Decision-30-Regel bis 0 Findings. Browser-Smoke ist testing-engineer-Pflicht (NICHT Architect, NICHT Engineer-Self) via `playwright-cli` mit Snapshot + Console-Log-Artefakt. User-CR pro Slice entfällt — User macht ggf. Final-Acceptance nach allen restlichen Slices. Stop-and-Ask-Lagen klar definiert in Memory-File. | User-Vereinbarung am Slice-3-Ende: "ich kann nicht 5 Slices à 100+ Files manuell reviewen". Trust-Bedingung: konsequente Einhaltung der Gates + Pre-Slice-Disziplin (MEMORY.md + plan-File lesen vor Slice-Start). |

## 18. Slice-Status + Konsolidierte Roadmap (Stand 2026-05-19)

### Slice-Status

| Slice | Status | PR | Commits | Files | Tests | Notes |
|---|---|---|---|---|---|---|
| 1 | DONE | #1 (merged) | ~25 | ~50 | Baseline | Adapter-SPI + ENV-Resilienz + Null/Mock-Adapter |
| 2 | DONE | #2 (merged) | ~30 | ~70 | 116/999 → 120/1025 | 5 Pilot-Komponenten + Pattern A/A.2 + Component-Map-Foundation |
| 3 | DONE | #3 (merged) | 98 | 184 | 120/1025 → 124/1047 | 14 Komponenten + 7 Pattern-A-Inseln + 4 Container + Mock-Adapter-Rename + Render-Pipeline (Renderer + Page-Route + Fixture + Module-Graph-Helper) |
| 4 | DONE | #4 (merged) | 13 | 31 | 124/1047 → 129/1144 | StoryblokCmsAdapter + TipTap-Mapper + article-Migration + Storyblok-Layer-Cleanup. 2 Cross-Review-Iterationen (1 Blocker `getEditableProps`-Renderer-Gap + 1 Minor JSDoc gefunden + gefixt). |
| **5** | DONE | PR #2 (gemerged in target 2026-05-20) | 7 | 49 | 129/1144 → 139/1211 | Layout-Pipeline + Banner-Voll-Migration. 1 Cross-Review-Iteration, 0 Findings, 5 Engineer-Selbstentscheidungen (React-Context→Prop, Zod-Split, Mock-Builder-Erweiterung, Banner-Location, Context-File-Deletion) alle akzeptabel. Memory `feedback_branch_and_pr_workflow.md` nach PR-Workflow-Korrektur ergänzt. |
| **7 (vormals 7+8)** | DONE | PR #7 (gemerged in target 2026-05-20) | 7 | 24 | 139/1211 → 145/1300 | Webhook-Cache-Invalidation + Framework-Doku + Polish. 1 Cross-Review-Iteration, 0 Findings. HMAC-SHA-256 + `crypto.timingSafeEqual`, granular Cache-Invalidate, Catch-All-Endpoint mit CSRF-Bypass. 5 Engineer-Selbstentscheidungen alle akzeptabel. |
| **6** | NEXT (korrigiert) | — | — | ~8-12 (geschätzt) | — | Per-Site-Theming. **Korrektur 2026-05-20**: Architect-Fehler bei der Auslegung von User-Aussage am 2026-05-20 — Slice 6 war fälschlich als ENTFÄLLT markiert. Ticket-Re-Check via Jira-Screenshot bestätigte: AC #2 fordert explizit "custom styling per site", "(per-site) styles properly propagate", und `docs/styling-and-theming.md`-Update. Slice 6 wird nachgeholt nach Slice 7. CSS-Custom-Properties + Static-Import-Map-Pattern (Architekt-Entscheidung TH1). Beispiel-Themes für Demo-Sites + Default-Fallback. |

### Lessons learned aus Slice 3

1. **Module-Subgraph-Trigger** ([[feedback_use_client_audit]]): `'use client'`-Audit darf nicht nur Hooks/Browser-API prüfen, sondern auch Konsumenten-Pfad. Decision 29.
2. **0-Findings-Approve** ([[feedback_cross_review_discipline]]): "PASS mit Caveat" produziert Tech-Debt-Akkumulation. Decision 30.
3. **Browser-Smoke pro Slice** ([[feedback_quality_gates_per_slice]] Gate #6): erste Anwendung produzierte 4 Errors + 1 Warning, die 4 vorherige CR-Iterationen verpasst hatten.
4. **testing-engineer macht Browser-Smoke**, nicht Architect. User-Direktive 2026-05-19.
5. **Test-Vertrag-Drift-Check** ([[feedback_quality_gates_per_slice]] Gate #5): bestehende `expect()`-Assertions dürfen nicht gelockert werden, um Tests grün zu halten.
6. **Render-Pipeline-Anschluss** ist nicht trivial — `getCmsService()`-Helper kompensiert Turbopack-Module-Graph-Split. Pattern für künftige programmatic DI-Aliases dokumentiert in `src/instrumentation.ts` JSDoc.

### Lessons learned aus Slice 4

1. **`getEditableProps` Renderer-Integration**: Adapter-SPI-Methode allein reicht nicht — wenn der Renderer den Service nicht konsultiert, läuft das Feature ins Leere. Architect hat das **vorab geflagged** (im Slice-4-Test-Strategie-Briefing). testing-engineer hat es als Blocker B1 verifiziert (`cms-renderer.tsx` rief `getEditableProps` nicht auf → Visual-Editor-Anchoring fehlte). Fix-Pattern: Pre-Compute im Page-Layer + Map-Forwarding an den Renderer (Renderer bleibt service-frei).
2. **Pattern für rekursive Adapter-Daten-Compute**: `collectComponents` rekursiver Walker für Page-Body / Container-Children produziert eine `Map<componentId, AdapterData>`. Dieser Pattern wird in Slice 5 wiederverwendet (Layout-Body-Walk).
3. **Scope-Disziplin**: Slice 4 hatte 31 Files (deutlich kleiner als Slice 3 mit 184) — Konsolidierung auf "ein klarer Vertical Slice" funktioniert. 2 Cross-Review-Iterationen (statt 4 wie Slice 3).
4. **Pre-Audit-Vorab-Flag spart Iterationen**: Architect-Memory-pflichtmäßiges Vorab-Lesen von `richtext-storyblok.tsx` vs. `richtext/schema.ts` hat die `hr`/`br`-Schema-Lücke früh aufgedeckt → User-Klärung VOR Engineer-Build → keine Iteration verschwendet.

### Pre-Slice-Disziplin (vor jedem Slice-Start)

Pflicht-Steps für Architect:
1. MEMORY.md komplett lesen (alle 3 Memory-Files in `.claude/agent-memory/architect/`)
2. Decision Log §15 + §17.5 dieses Plan-Files lesen
3. Vorheriger Slice-Plan-File Lessons-Learned-Eintrag lesen (falls existiert)
4. Test-Count + Suite-Count-Baseline notieren (für Drift-Check)
5. Slice-Detail-Plan in `.claude/SHOW-323-slice-<N>.md` schreiben mit File-Inventar

### Memory-Pointer

| Memory-File | Was |
|---|---|
| `.claude/agent-memory/architect/feedback_use_client_audit.md` | `'use client'`-Audit-Regel inkl. Module-Subgraph-Trigger |
| `.claude/agent-memory/architect/feedback_cross_review_discipline.md` | 0-Findings-Approve-Regel |
| `.claude/agent-memory/architect/feedback_quality_gates_per_slice.md` | **Die 10 Gates** + Pro-Slice-Ablauf + Stop-and-Ask + Context-Erschöpfungs-Plan |
| `.claude/agent-memory/architect/MEMORY.md` | Index, wird automatisch beim Architect-Start geladen |

