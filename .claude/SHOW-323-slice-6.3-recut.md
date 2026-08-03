# Slice 6.3 RE-CUT — CMS Adapters own their render path (SDK-Pivot)

> **Branch**: `feature/SHOW-323` (HEAD `7686bd5` + uncommitted WIP)
> **ADR**: `docs/adr/0001-cms-adapters-own-their-render-path.md`
> **Modus**: autonom, kein User-CR pro Slice. PR am Ende auf Gitea.
> **Ersetzt**: den Wrapper-basierten Live-Edit-Ansatz aus dem ursprünglichen Slice 6.3.
> **Größe**: groß (~12-18 Files). Risiko: mittel-hoch (Render-Pfad-Umbau).

## Ziel (was am Ende funktionieren MUSS)

1. **Live-Edit funktioniert** im Storyblok-Visual-Editor (Feld ändern → Preview-iframe updated ohne Save/Reload). SDK macht das, nicht wir.
2. **Click-to-Select funktioniert** (bleibt — tut es schon).
3. **Kein Doppel-Render** der `_layouts/*`-Stories.
4. **8/8 Bloks** Visual-Editor-anchored.
5. **Normale Besucher**: SSR wie bisher, kein zusätzlicher Client-Overhead, identisches Markup.
6. Seam-Leaks D2/D3/D4 eliminiert.

## Architekt-Entscheidungen (verbindlich)

| # | Entscheidung |
|---|---|
| **R1** | `CmsAdapter`-SPI bekommt `renderPage(ctx: CmsRenderContext): Promise<ReactNode>`. Der Shell `cms-page.tsx` delegiert das Rendering daran. |
| **R2** | `CmsRenderContext = { slug, locale, site, searchParams? }`. Der Adapter erkennt seinen **eigenen** Preview-Modus aus `searchParams` (Storyblok: `_storyblok`). `cms-page.tsx` kennt keine Storyblok-Query-Keys mehr (D3). |
| **R3** | **Storyblok-Adapter** `renderPage`: holt die Story (`version: draft` wenn Preview erkannt, sonst `published`), gibt `<StoryblokStory story={...} />` zurück. SSR + Live-Edit nativ über das SDK. |
| **R4** | **Component-Registry**: `storyblokInit({ components })` mappt Storyblok-Component-Namen → **dünne Storyblok-Wrapper** in `src/platform/integrations/storyblok/cms/components/`. Jeder Wrapper mappt `blok → shared-UI-props`, wendet `storyblokEditable(blok)` an, rendert die **shared** UI-Komponente aus `src/components/cms/`. Registry muss sowohl im RSC-Init (`StoryblokCmsApi`) als auch im Client-Init (Bridge) registriert sein, damit der Client-Re-Render die Komponenten auflöst. |
| **R5** | **Local-Adapter** `renderPage`: behält `CmsRenderer` + `cmsComponentMap` als **sein** Render-Tool. Ruft intern `getPage` und rendert die `components[]` über den zentralen Renderer. |
| **R6** | **`getEditableProps` raus** aus SPI + `DelegatingCmsServiceSSR` + `StoryblokCmsAdapter`. `buildEditablePropsMap` / `collectComponents` / `EditablePropsMap`-Threading in `cms-page.tsx` + `cms-renderer.tsx` **gelöscht** (D2). `storyblokEditable` lebt jetzt in den Storyblok-Wrappern (R4). |
| **R7** | **`LiveEditWrapper` raus** aus SPI + Adapter. `StoryblokLiveEditWrapper.tsx` + Test **gelöscht** — das SDK (`StoryblokStory`) besitzt Live-Edit. |
| **R8** | **`BridgeScript` bleibt** — einmalig im Root-Layout gemountet, lädt das Bridge-Script + Client-`storyblokInit({ components, bridge: true })`. |
| **R9** | **Doppel-Render-Fix**: `renderPage` im Storyblok-Adapter erkennt `_layouts/`-prefixed Slug → rendert die Layout-Story **flat** (kein Page+Layout-Wrap, keine content-slot-Substitution, weil keine Page existiert). Page-Slugs: Layout holen + Page-Body am content-slot substituieren. Die Page-vs-Layout-Logik lebt jetzt im Adapter, wo sie hingehört. |
| **R10** | **content-slot / Layout-Substitution im SDK-Pfad**: Der registrierte `content-slot`-Wrapper liest den Page-Body aus einem React-Context, den der Storyblok-`renderPage` setzt (Page-Body als Context-Value, Layout-Story via `StoryblokStory` gerendert). **Höchstes Implementierungs-Risiko — Stop-and-Ask wenn das mit `StoryblokStory` nicht sauber komponierbar ist.** |
| **R11** | **Richtext**: der Storyblok-Richtext-Wrapper **wiederverwendet** die bestehende `StoryblokCmsMapper.mapRichtext`-Logik (TipTap→AST) und reicht den AST an die **shared** `<Richtext>`-Komponente. Kein neues `@storyblok/richtext`-Dependency in diesem Slice (Risiko-Minimierung). `@storyblok/richtext` als Follow-up-Vereinfachung notieren. |
| **R12** | **Domain-Model-Cleanup (D4)**: `CMSComponent`/Schemas tragen keine Storyblok-Metadaten (`_editable`) mehr durch den agnostischen Pfad. `_uid`-Leck in `navigation/schema.ts` beheben (sollte `id` sein, vom Mapper geschrieben). Minimal halten — nur was der Pivot berührt. |
| **R13** | **Version-Override in der Kapsel** (Architekt-Klärung nach testing-engineer-Befund): `StoryblokCmsApi.getStory(slug, locale, site?, version?)` bekommt einen optionalen `version: 'draft' \| 'published'`-Parameter. Liegt er vor → gewinnt er über `resolveVersion()` (env); fehlt er → env-Fallback (rückwärtskompatibel für `getPage`-Metadata-Calls). `renderPage` erkennt Preview aus `ctx.searchParams._storyblok` und gibt `draft` (Preview) bzw. `published` (Besucher) rein. **Kein** direkter `getStoryblokApi().get` im Adapter — die Kapsel bleibt der EINZIGE Content-Delivery-SDK-Touchpoint. Der einzige neue SDK-Import im Adapter ist `StoryblokStory` (Rendering, R3). |
| **R14** | **Naming-Korrektur**: Der JSON-Fixture-Adapter heißt `MockCmsAdapter` (`src/platform/integrations/mock/cms/impl/MockCmsAdapter.ts`, id `mock`) — **kein** `LocalJsonCmsAdapter` (existiert nicht). R5 gilt für `MockCmsAdapter`. |

## Was vom aktuellen WIP überlebt

| WIP-Artefakt | Schicksal |
|---|---|
| `StoryblokLiveEditWrapper.tsx` + `.test.tsx` | **löschen** (R7) |
| `StoryblokCmsAdapter.live-edit.test.ts` | **löschen** (testet entferntes `LiveEditWrapper`) |
| `cms-page.live-edit.test.tsx` | **ersetzen** durch `renderPage`-Delegations-Tests |
| `cms-page.tsx` Preview-Gate + `liveEditInitial` + editableProps-Walk | **ersetzen** durch schlanke `renderPage`-Delegation |
| `top-banner-announcement.tsx` `...rest`-Spread + Tests | **behalten** — die Storyblok-Wrapper geben `data-blok-*` an die shared TopBanner weiter |
| `searchParams`-Wiring in den 2 Routen | **behalten** — der Adapter braucht `searchParams` für Preview-Erkennung |
| `_storyblok`-flat-key-Fix | **wandert** in den Storyblok-Adapter (R2) |

## SPI-Zielbild

```typescript
// CmsAdapter.d.ts
export interface CmsRenderContext {
  readonly slug: string;
  readonly locale: string;
  readonly site: string;
  readonly searchParams?: Record<string, string | string[] | undefined>;
}

export interface CmsAdapter {
  readonly id: CmsProviderId;
  hasContent(): boolean;
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;     // metadata + (Local) render data
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  getLayout?(layoutId: string, locale: string, site: string): Promise<CMSLayout | CMSNoResult>;
  /** Adapter-owned rendering. Returns the rendered page body (without the shared margin wrapper). */
  renderPage(ctx: CmsRenderContext): Promise<ReactNode>;
  BridgeScript?: ComponentType;
  // getEditableProps?  -> ENTFERNT (R6)
  // LiveEditWrapper?   -> ENTFERNT (R7)
  handleWebhook?(request: Request): Promise<WebhookResponse>;
  validateWebhookSignature?(headers: Headers, rawBody: string): boolean;
  mapWebhookPayload?(headers: Headers, body: unknown): WebhookEvent[] | null;
}
```

`cms-page.tsx` (Zielbild, schlank):
```tsx
export async function CmsPage({ slug, locale, site, emptyOnNoResult, searchParams }: CmsPageProps) {
  const cms = await getCmsService();
  const page = await cms.getPage(slug, locale, site);
  if (isNoResult(page)) {
    if (emptyOnNoResult) return <div className="flex-grow mt-17 sm:mt-36 md:mt-52" />;
    notFound();
  }
  const body = await cms.renderPage({ slug, locale, site, searchParams });
  return <div className={page.no_margin ? '' : 'flex-grow mt-17 sm:mt-36 md:mt-52'}>{body}</div>;
}
```
Kein `getEditableProps`, kein `buildEditablePropsMap`, kein `_storyblok`, kein `LiveEditWrapper`.

## File-Inventar

### Service-Layer
| Datei | Änderung |
|---|---|
| `CmsAdapter.d.ts` | `+renderPage` + `CmsRenderContext`; `-getEditableProps`; `-LiveEditWrapper` |
| `CMSService.d.ts` | `+renderPage`; `-getEditableProps`; `-LiveEditWrapper` |
| `impl/DelegatingCmsServiceSSR.ts` | `renderPage`-Delegation; `getEditableProps`/`LiveEditWrapper`-Fallbacks raus |
| `impl/NullCmsAdapter.ts` | `renderPage` → `null` (kein CMS) |
| `__tests__/CmsAdapter.contract.ts` | Contract um `renderPage` erweitern; `getEditableProps`-Block raus |

### Integration — Storyblok
| Datei | Änderung |
|---|---|
| `impl/StoryblokCmsAdapter.ts` | `+renderPage` (StoryblokStory, draft/published, _layouts-flat, layout+content-slot); `-getEditableProps`; `-LiveEditWrapper`-Getter |
| `impl/StoryblokCmsApi.ts` | `storyblokInit` um `components`-Registry erweitern (RSC-Seite) |
| `impl/StoryblokBridgeScript.tsx` | Client-`storyblokInit({ components, bridge: true })` mit derselben Registry |
| `components/` (neu) | dünne Wrapper pro Storyblok-Component-Name → shared UI + `storyblokEditable` |
| `components/registry.ts` (neu) | zentrale `components`-Map, von RSC- und Client-Init geteilt |
| `impl/StoryblokLiveEditWrapper.tsx` (+test) | **gelöscht** |
| `impl/StoryblokCmsMapper.ts` | `mapRichtext` bleibt (von Wrappern wiederverwendet); `_uid`→`id` konsistent (R12) |

### Integration — Local
| Datei | Änderung |
|---|---|
| `local/cms/impl/LocalJsonCmsAdapter.ts` | `+renderPage` → `<CmsRenderer>` über `getPage().components` |

### UI
| Datei | Änderung |
|---|---|
| `cms-page.tsx` | schlanke `renderPage`-Delegation (siehe Zielbild); editableProps-Walk + `_storyblok` raus |
| `cms-renderer.tsx` | `editablePropsMap`-Param raus (D2); bleibt Local-Render-Tool |
| `component-map.ts` / `component-schema.ts` | bleiben (Local-Pfad + shared Komponenten-Props) |
| `navigation/schema.ts` | `_uid` → `id` (R12) |
| `top-banner-announcement.tsx` | bleibt (R4-Wrapper reicht `data-blok-*` durch) |

## Test-Strategie (testing-engineer, Pre-Impl)

- **Contract**: jeder Adapter erfüllt `renderPage` (gibt ReactNode/Element zurück, wirft nie, `NullCmsAdapter` → null).
- **Storyblok renderPage**: Preview-Erkennung aus `searchParams` (`_storyblok` → draft, sonst published); `_layouts/`-Slug → flat render (kein Doppel); Registry-Auflösung mockbar.
- **Local renderPage**: rendert `getPage().components` über `CmsRenderer`.
- **cms-page.tsx**: delegiert an `renderPage`; kein editableProps-Walk mehr; no-result/empty/margin-Verhalten unverändert.
- **Storyblok-Wrapper**: mappen `blok → shared-props`, wenden `storyblokEditable` an (mockbar), rendern shared Komponente.
- **Drift-Check**: gelöschte Tests (`getEditableProps`, `LiveEditWrapper`, `cms-page.live-edit`) sind legitime Deletions per ADR — kein Loosen bestehender Asserts.
- **Browser-Smoke (Architect, headed)**: Live-Edit (Feld ändern → DOM-Update ohne Reload), Click-to-Select, kein Doppel-Render auf `_layouts/default`, 8/8 Anchors, normale Seite SSR ok.

## Quality Gates (alle vor Push)
`npm run lint` · `npx tsc --noEmit` · `npm test` · `npm run build` · `npm run verify:client-chunks` — alle grün. Browser-Smoke grün.

## Stop-and-Ask-Lagen
- **R10 content-slot/Layout im SDK-Pfad**: wenn `StoryblokStory` + Context-Injection des Page-Body nicht sauber komponierbar — an Architect zurück, bevor gehackt wird.
- **Registry-Doppel-Init** (RSC + Client): wenn die `components`-Map nicht in beiden Kontexten ohne `'use client'`-Leak teilbar ist — melden.
- **`verify:client-chunks`**: SDK-Client-Teile dürfen keine Server-Symbols ziehen.

## Hand-off-Reihenfolge
1. testing-engineer: Test-Strategie + Pre-Impl-Tests (failing), gelöschte Tests entfernen. Background.
2. frontend-developer: Implementation P1-Pn. Background.
   - P1 SPI (`renderPage`, `CmsRenderContext`, Removals)
   - P2 Storyblok-Registry + Wrapper + `renderPage` (StoryblokStory)
   - P3 content-slot/Layout im SDK-Pfad (R10)
   - P4 Local-Adapter `renderPage`
   - P5 cms-page.tsx Schlankheitskur + cms-renderer editableProps-Removal
   - P6 Cleanup (LiveEditWrapper löschen, Domain-Model D4, navigation `_uid`)
3. Cross-Review-Loop (Architect + testing-engineer, 0 Findings).
4. Browser-Smoke (Architect, headed, Storyblok-Session).
5. Commit + PR auf Gitea (`head=feature/SHOW-323`, `base=feature/SHOW-323-target`).

## Lessons-Learned-Anhang
(leer)
