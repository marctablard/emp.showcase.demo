# Plan: Phase D — Layout-Pipeline + Banner-Migration (+ optional STORYBLOK-Token-Rename)

Quelle: [SHOW-323-slice-5.md](./SHOW-323-slice-5.md). Phase-Mapping korrigiert in [SHOW-323-port-plan-v3.md](./SHOW-323-port-plan-v3.md) §5.

## 1. Context / Problem

Heute hat das CMS-Framework nur `getPage` / `getNavigation` in der SPI. Pages sind komplette Bäume — kein Konzept von Layout (Navigation/Banner/Content/Footer) als wiederverwendete Hülle. Konsequenz:
- Banner (`top-banner-announcement`) wird heute über einen separaten Pfad geholt (`use-banner.ts` Hook + `lib/storyblok.ts` Storyblok-Direct-Accessor + ggf. `/api/cms/banner`-Route) — verstößt gegen die Plugin-=-nur-Adapter-Maxime ([[feedback-plugin-adapter-only-integration]]), weil ein zweiter Storyblok-Konsumweg neben dem Adapter existiert.
- Navigation/Footer werden bisher implizit pro Page mitgerendert.

Slice 5 führt **Layout als first-class CMS-Konzept** ein, migriert den Banner-Pfad vollständig in die Adapter-Pipeline und räumt die Storyblok-Direct-Reste aus `src/lib/storyblok.ts` weg.

## 2. Schichten-Schnitt

Layer-Aufteilung pro Datei. Provider-Name bleibt **`local`** ([[feedback-local-provider-stays]]), Slice-5-Spec referenziert `mock` — beim Lesen mental übersetzen.

| Datei | Layer | neu/geändert | Tests |
|---|---|---|---|
| `src/components/cms/layout/schema.ts` | UI / Schema | neu | Unit (Zod parse + `.refine()` „transitiv genau 1 content-slot") |
| `src/components/cms/layout/layout.tsx` | UI | neu | RTL render |
| `src/components/cms/layout/layout.test.tsx` | UI | neu | Schema- + Render-Tests |
| `src/components/cms/layout/index.ts` | UI | neu | — |
| `src/components/cms/content-slot/schema.ts` | UI / Schema | neu | Unit |
| `src/components/cms/content-slot/content-slot.tsx` | UI | neu | — |
| `src/components/cms/content-slot/content-slot.test.tsx` | UI | neu | RTL incl. Context-Konsum |
| `src/components/cms/content-slot/index.ts` | UI | neu | — |
| `src/platform/services/cms/layout-cache.ts` | Service | neu | TTL/Invalidation Unit |
| `src/platform/services/cms/layout-cache.test.ts` | Service | neu | — |
| `src/platform/services/cms/CMSService.d.ts` | Service | geändert | (kompiliert mit Tests) |
| `src/platform/services/cms/CmsAdapter.d.ts` | Service | geändert | Contract-Suite-Erweiterung |
| `src/platform/services/model/cms/cms-content.d.ts` | Model | geändert | — |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.ts` | Service | geändert | layout-test.ts |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.layout.test.ts` | Service | neu | Cache-Hit/-Miss + Delegation |
| `src/platform/services/cms/impl/NullCmsAdapter.ts` | Service | geändert | Test ergänzt |
| `src/platform/services/cms/impl/NullCmsAdapter.test.ts` | Service | geändert | — |
| `src/platform/services/cms/__tests__/CmsAdapter.contract.ts` | Service-Test-Helper | geändert | + Layout-Contract |
| `src/platform/services/cms/impl/NullCmsAdapter.contract.test.ts` | Service | geändert | — |
| `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.ts` | Integration | geändert | + getLayout aus Fixture |
| `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.test.ts` | Integration | geändert | — |
| `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.contract.test.ts` | Integration | geändert | — |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.ts` | Integration | geändert | + getLayout via `getStory('_layouts/...')` |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.test.ts` | Integration | geändert | — |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.contract.test.ts` | Integration | geändert | — |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.ts` | Integration | geändert | Story→CMSLayout Mapping |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsMapper.test.ts` | Integration | geändert | — |
| `src/components/cms/component-map.ts` | UI | geändert | Drift-Guard inventory 19→22 |
| `src/components/cms/component-schema.ts` | UI | geändert | — |
| `src/components/cms/component-map.test.ts` | UI | geändert | Drift-Guard erweitert |
| `src/components/cms/container-init-order-drift.test.ts` | UI | geändert | + `layout` als rekursiver Container |
| `src/components/cms/page/schema.ts` | UI | geändert | + optional `layoutId` |
| `src/components/cms/page/page.test.tsx` | UI | geändert | — |
| `src/components/cms/_core/cms-page.tsx` | UI | geändert | Layout-Resolution, Page-Body als Context-Provider |
| `src/components/cms/_core/cms-page.test.tsx` | UI | geändert | — |
| `src/components/cms/_core/cms-renderer.tsx` | UI | geändert | content-slot Special-Case via Context |
| `src/components/cms/_core/cms-renderer.test.tsx` | UI | geändert | — |
| `src/components/cms/_core/renderer-provider-agnostic.drift.test.ts` | UI | geändert (ggf.) | falls layout-import auf Boundary-Liste muss |
| `src/data/cms/_default_/de/_layouts/default.json` | Fixture | neu | (E2E sieht) |
| `src/data/cms/_default_/en/_layouts/default.json` | Fixture | neu | — |
| `src/data/cms/_default_/de/home.json` | Fixture | geändert | (optional `layoutId: 'default'` ergänzen) |
| `src/data/cms/_default_/en/home.json` | Fixture | geändert | — |
| `.env.template` | ENV-Doku | geändert | `NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS=3600000` |

**Banner-Voll-Migration (P4):**

| Datei | Aktion |
|---|---|
| `src/components/cms/top-banner-announcement/*` | bleibt (existiert seit Phase B'/C als Co-Location). Wird in Default-Layout-JSON referenziert. |
| `src/components/cms/top-banner-announcement.tsx` (alt flach) | falls noch da: löschen |
| `src/hooks/banner/use-banner.ts` | **gelöscht** |
| `src/hooks/banner/use-banner.test.tsx` | **gelöscht** |
| `src/app/api/cms/banner/route.ts` | **gelöscht** (falls existiert) |
| `src/lib/storyblok.ts` | **gelöscht** — letzter Konsument war `use-banner.ts` |
| `src/lib/storyblok.test.ts` | **gelöscht** (falls existiert) |
| Caller von `use-banner` / `lib/storyblok` | identifizieren via grep, auf Banner-im-Layout-Pfad umstellen |

**Sub-Scope Token-Rename (P6, optional):**

| Datei | Aktion |
|---|---|
| `src/platform/services/cms/CmsProviderResolver.ts` | `process.env.STORYBLOK_ACCESS_TOKEN` |
| `src/platform/services/cms/CmsProviderResolver.test.ts` | Test-Env umstellen |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.ts` | `process.env.STORYBLOK_ACCESS_TOKEN` |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.test.ts` | — |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.test.ts` | — |
| `src/platform/integrations/storyblok/cms/impl/StoryblokBridgeScript.tsx` | **Pattern A**: Token nicht mehr selbst lesen — als Prop empfangen |
| `src/platform/integrations/storyblok/cms/impl/StoryblokBridgeScript.test.tsx` | — |
| Server-Parent (vermutlich `layout.tsx` oder Site-Provider) | reads `process.env.STORYBLOK_ACCESS_TOKEN`, gibt Token an `<StoryblokBridgeScript token={...} />` weiter |
| `src/platform/healthcheck/env-validation.ts` | Rename in OPTIONAL_ENV_VARS |
| `src/platform/healthcheck/__tests__/env-validation.test.ts` | — |
| `.env.template`, `docs/cms-framework.md`, `docs/environment-variables.md`, `docs/run-build-deploy.md`, `docs/storyblok-integration.md` | Rename in Doku |

Memory-Risiko: aktuell loadbearing-Frontend-Code, der den Token direkt liest, ist auf 1 File begrenzt (`StoryblokBridgeScript.tsx`). Andere Stellen sind Server-Module ohne `'use client'`/`'use server'`-Direktive — laufen in der DI-Container/SSR-Welt, kein Bundling-Risiko.

## 3. Interfaces

```typescript
// CMSService.d.ts (Add)
export interface CMSService {
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  /** Resolves a layout by id, with optional caching. */
  getLayout(layoutId: string, locale: string, site: string): Promise<CMSLayout | CMSNoResult>;
}

// CmsAdapter.d.ts (Add SPI)
export interface CmsAdapter {
  readonly id: string;
  hasContent(): boolean;
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  getLayout(layoutId: string, locale: string, site: string): Promise<CMSLayout | CMSNoResult>;
  // Optional surfaces (unchanged):
  getEditableProps?(component: CMSComponent): HTMLAttributes<HTMLElement>;
  BridgeScript?: ComponentType<{ token?: string }>;  // token-Prop neu (Token-Rename-Sub-Scope)
}

// cms-content.d.ts (Add)
export interface CMSLayout {
  type: 'layout';
  id: string;
  body: CMSComponent[];     // muss transitiv genau einen content-slot enthalten
}

// layout/schema.ts
const ContainsExactlyOneContentSlot = (body: CMSComponent[]): boolean => { /* recurse */ };
export const LayoutSchema = z.object({
  type: z.literal('layout'),
  id: z.string(),
  body: z.array(z.lazy(() => CMSComponentSchema)),
}).refine(d => ContainsExactlyOneContentSlot(d.body), 'Layout must contain exactly one content-slot');

// content-slot/schema.ts
export const ContentSlotSchema = z.object({
  type: z.literal('content-slot'),
  id: z.string(),
});

// page/schema.ts (Add optional)
LayoutId: z.string().optional()
```

Layout-Renderer-Pattern (cms-renderer.tsx):
```typescript
// React-Context für Page-Body-Children durchreichen
const PageBodyContext = createContext<ReactNode | null>(null);

// In cms-page.tsx (Server):
const page = await cmsService.getPage(slug, locale, site);
const layoutId = page.layoutId ?? 'default';
const layout = await cmsService.getLayout(layoutId, locale, site);
const pageBodyChildren = page.body.map(c => <CmsRenderer key={c.id} component={c} />);

return layout.notfound
  ? <>{pageBodyChildren}</>                                                                    // A5 Fallback
  : <PageBodyContext value={pageBodyChildren}>
      {layout.body.map(c => <CmsRenderer key={c.id} component={c} />)}
    </PageBodyContext>;

// In cms-renderer.tsx (content-slot Special-Case):
if (type === 'content-slot') {
  const children = use(PageBodyContext);
  return <>{children}</>;
}
```

## 4. DI-Bindings

Keine neuen Container-Bindings — Layout läuft über bestehende `CMSService`/`CmsAdapter`-Aliase (`getCmsService()` lazy-Bind aus Phase C bleibt unverändert). Layout-Cache ist `globalThis`-basiert (kein Container).

## 5. ENV-Variablen

| Name | Tier | Default | Notiz |
|---|---|---|---|
| `NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS` | 3 (Public) | `"3600000"` (1h) | Cache-TTL, gleiches Pattern wie Page-Cache aus Phase A |
| `STORYBLOK_ACCESS_TOKEN` (optional, P6) | 2 (Server) | `""` | ersetzt `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` |
| `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` (deprecated bei P6) | — | — | nach Rename entfernt — Migrations-Doku in `.env.template` |

## 6. Migration / Rückwärtskompatibilität

- **Pages ohne `layoutId`-Feld:** Fallback auf `'default'`, gerendert via Default-Layout-Fixture. Bestehende home.json bleibt funktional, optional `layoutId: 'default'` ergänzt.
- **`local`-Provider ohne `_layouts/`-Folder:** notfound → A5-Fallback (direkter Page-Body-Render, kein Crash).
- **`storyblok`-Provider ohne `_layouts/default`-Story:** notfound → A5-Fallback.
- **`use-banner.ts`-Konsumenten:** vor Löschung in P4 grep, alle auf Banner-im-Layout-Pfad umstellen oder Banner-Komponente direkt verwenden.
- **`lib/storyblok.ts`-Konsumenten:** ebenfalls grep + ersetzen vor Löschung. Slice 5 sagt letzter Konsument = `use-banner.ts` — verifizieren.
- **`StoryblokBridgeScript.tsx` (bei P6):** token-Lese-Code raus, prop empfangen. Server-Parent muss Token reichen — bei aktueller Architektur vermutlich `src/components/storyblok-bridge/` o.ä. (im Slice-5-Plan nicht explizit benannt → frontend-developer in P6 identifizieren).

## 7. Test-Strategie

*Vom `testing-engineer` im Strategie-Modus zugeliefert. Wird beim Hand-off-Brief mit File-Liste + Architekt-Entscheidungen A1–A5 versorgt; deliverable ist Test-Strategie pro File + Browser-Smoke-Plan für Gate 6.*

Spezifika, die im Strategie-Brief zu erwähnen sind:
- **Layout-Schema-Refine-Test:** transitive Validation, mehrere Container-Levels tief (z.B. `layout > segment > columns > content-slot` und negative Variante mit 0 oder 2 content-slots).
- **Cache-Behavior:** zweite getLayout-Anfrage innerhalb TTL ist Cache-Hit (Mock-Adapter-call-count = 1).
- **ContentSlot-Context-Konsum:** Page-Body-Children erscheinen an der DOM-Position des content-slot, nicht überall im Layout.
- **A5 Fallback:** `cms-page.tsx` mit `getLayout` → notfound rendert Page-Body direkt, kein Crash, kein `notFound()`.
- **Banner-DOM-Equivalence:** Pre-Migration-Render vs. Post-Migration-Render von `top-banner-announcement` ist visuell identisch (Snapshot oder DOM-Compare).
- **Gate 6 Browser-Smoke:** `next build && next start`, `NEXT_PUBLIC_CMS_PROVIDER=local` rendert Default-Layout, `NEXT_PUBLIC_CMS_PROVIDER=storyblok` ohne Token = A5 Fallback (kein Crash). Live-Edge-Runtime ([[feedback-test-real-edge-runtime]]), nicht jest-only.

## 8. Akzeptanzkriterien & Hand-off

### Akzeptanzkriterien
- [ ] AC-1: `CMSService.getLayout(layoutId, locale, site)` existiert und ist in allen 3 Adaptern (`NullCmsAdapter`, `LocalJsonCmsAdapter`, `StoryblokCmsAdapter`) implementiert.
- [ ] AC-2: Layout-Schema validiert „transitiv genau ein content-slot" via Zod `.refine()` und ist im `cmsComponentMap`/`component-schema` registriert (Drift-Guard grün).
- [ ] AC-3: `<CmsPage>` resolved Layout via `getLayout`, mountet `PageBodyContext`, rendert via Layout-Body; ContentSlot zieht Page-Body-Children aus Context.
- [ ] AC-4: `LocalJsonCmsAdapter.getLayout('default', locale, site)` liest aus `src/data/cms/_default_/<locale>/_layouts/default.json` und rendert Banner + Navigation + Content + Footer.
- [ ] AC-5: `StoryblokCmsAdapter.getLayout('default', ...)` via `getStory('_layouts/default')` + Story→CMSLayout Mapper.
- [ ] AC-6: Layout-Cache: zweite Anfrage innerhalb TTL ist Cache-Hit, dritte Anfrage nach Ablauf ist Cache-Miss (Test pinned).
- [ ] AC-7: Page ohne `layoutId` und ohne Default-Layout-Fixture → A5 Fallback (Page-Body direct, kein Crash).
- [ ] AC-8: Banner-Render visuell-identisch zur Pre-Migration-Form (DOM-Equivalence-Test).
- [ ] AC-9: `use-banner.ts` + `lib/storyblok.ts` + `/api/cms/banner`-Route + alte flache `top-banner-announcement.tsx` sind entfernt; `npm run jest`/`npm run lint`/`npm run build` grün.
- [ ] AC-10: Gate 6 Browser-Smoke (Live-Edge): `local` + `storyblok-ohne-Token` beide ohne Console-Errors.
- [ ] AC-11 (P6, optional): Token-Rename auf `STORYBLOK_ACCESS_TOKEN` (server-only) durchgezogen; `StoryblokBridgeScript` bekommt Token per Prop von Server-Parent; alle Test-Envs umgestellt; `.env.template` + Doku gerefreshed.

### Hand-off Sequence

1. **testing-engineer Strategie-Modus** (Background) — Brief: File-Liste (oben §2), Architekt-Entscheidungen A1–A5, Test-Spezifika (§7). Deliverable: Test-Strategie-Comment pro File + Gate-6-Curl-Smoke-Plan.
2. **testing-engineer Pre-Implementation-Modus** (Background) — schreibt + committet ROTE Akzeptanz-Tests (AC-1 bis AC-10, AC-11 nur wenn P6 in Scope ist).
3. **frontend-developer Build-Modus** (Background) — iterativ P1–P5 (Slice-5-Phasing), optional P6 (Token-Rename). Macht Tests grün, pinnt Verhalten.
4. **Cross-Review-Loop** ([[feedback-full-cross-review-chain-every-phase]]): testing-engineer Cross-Review auf Impl + frontend-developer Cross-Review auf Tests + Architect Final-Review (Schichten/DI/ENV) — alle 0 Findings vor Push.
5. **Push** `feature/SHOW-323` → Gitea (origin gesperrt, [[feedback-port-phase-remote-isolation]]).
6. **PR** in Gitea (head=`feature/SHOW-323`, base=`feature/SHOW-323-target`, Title-Prefix `SHOW-323: ...`, [[feedback-pr-title-ticket-prefix]]).
7. **User-Review** in Gitea.
8. **Merge** + **Sync** `feature/SHOW-323` auf neuen target-Stand.

### Stop-and-Ask-Lagen (zu erwartende)

- **ContentSlot mit `slotId` für Multi-Slot-Layouts?** Slice 5 spec'd Single-Slot. Erst bei echtem Multi-Slot-Bedarf STOP — bisher kein Use-Case.
- **`StoryblokBridgeScript`-Token-Reicher Server-Parent (P6):** Wenn das Server-Parent nicht trivial identifizierbar ist (Site-Layout? RootLayout? per-Route?), STOP für Architektur-Entscheidung.
- **`lib/storyblok.ts`-Caller außerhalb `use-banner.ts`:** Wenn Grep weitere Konsumenten zeigt, STOP für Migrationsplan.
