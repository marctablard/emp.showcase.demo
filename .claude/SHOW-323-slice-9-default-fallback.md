# Slice 9 — Default-Content Fallback (Composite-Adapter)

## 1. Context / Problem

The `src/data/cms/_default_/` JSON tree already ships a complete demo design (layout + home page + 22 component instances, in `de/` and `en/`). It is wired in **only** through the `MockCmsAdapter` when both `NEXT_PUBLIC_CMS_PROVIDER=mock` and `NEXT_PUBLIC_CMS_MOCK_DEFAULT_SITE=_default_` are set.

When the active CMS provider is Storyblok (or any other real CMS) and a `getPage` / `getLayout` / `getNavigation` call returns `CMSNoResult` (e.g. because the CMS space is empty or a slug is missing), the UI renders an empty shell. Newcomers cloning the repo with the default `STORYBLOK_ACCESS_TOKEN` see a blank store.

## 2. Goal

Provide an opt-in default-content fallback: when the active CMS adapter returns `CMSNoResult`, an internal Composite-Adapter falls back to the existing `_default_` Mock tree. UI sees real content, primary adapter stays in charge for any slug it can serve.

Opt-in is the default mode in `.env.template` so that fresh clones see the showcase right away, but production deployments can disable it.

## 3. Schichten-Schnitt

| Datei                                                                          | Layer   | Art       | Tests                            |
|--------------------------------------------------------------------------------|---------|-----------|----------------------------------|
| `src/platform/services/cms/impl/FallbackCmsAdapter.ts`                         | Service | new       | `FallbackCmsAdapter.test.ts`     |
| `src/platform/services/cms/impl/FallbackCmsAdapter.test.ts`                    | Service | new       | (the unit test)                  |
| `src/platform/services/cms/CmsProviderResolver.ts`                             | Service | modified  | extend existing test             |
| `src/platform/services/cms/CmsProviderResolver.test.ts`                        | Service | modified  | extend                           |
| `src/instrumentation.ts`                                                       | Boot    | modified  | covered via SSR-init drift-guard |
| `.env.template`                                                                | Config  | modified  | —                                |
| `docs/cms-framework.md`                                                        | Docs    | modified  | —                                |

## 4. Interface

`FallbackCmsAdapter` implements `CmsAdapter` and wraps two existing adapters:

```typescript
@injectable('CmsAdapter:fallback', 'Singleton')
export class FallbackCmsAdapter implements CmsAdapter {
  readonly id: CmsProviderId = 'fallback';

  constructor(
    @inject('CmsAdapter:primary')  private primary: CmsAdapter,
    @inject('CmsAdapter:fallback-source') private fallbackSource: CmsAdapter,
    @inject('FallbackSiteCode')    private fallbackSite: string,  // '_default_'
  ) {}

  hasContent(): boolean {
    return this.primary.hasContent() || this.fallbackSource.hasContent();
  }

  async getPage(slug, locale, site) {
    const r = await this.primary.getPage(slug, locale, site);
    return isNoResult(r)
      ? this.fallbackSource.getPage(slug, locale, this.fallbackSite)
      : r;
  }

  // Same delegation pattern for getLayout, getNavigation.
  // Optional methods (handleWebhook, getEditableProps, etc.) delegate to primary only —
  // the fallback layer is content, not webhook/edit.
}
```

`isNoResult(r)` is a small helper: `r === CMSNoResult` or `r.kind === 'no-result'` (whichever shape the union uses today — engineer checks).

## 5. DI / Wiring

- `CMS_PROVIDER_IDS` extended with `'fallback'` only if we register the composite as a first-class provider. **Simpler**: keep the existing IDs (`storyblok | mock | none`), and gate fallback through an **orthogonal** flag.
- New env: `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER` (values: `mock` | unset). When set, `instrumentation.ts` binds `CmsAdapter` to a `FallbackCmsAdapter` instance whose `primary` is the resolved provider and `fallbackSource` is `MockCmsAdapter` with site `_default_`.
- When unset (default in prod), `CmsAdapter` is bound directly to the resolved provider — no composite layer.
- `.env.template` default: `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER=mock` so fresh clones get showcase content out of the box.

## 6. ENV

| Name                                | Tier | Default in `.env.template` | Effect                                                                              |
|-------------------------------------|------|----------------------------|-------------------------------------------------------------------------------------|
| `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER` | 3    | `mock`                     | When `mock`, composite-wraps the active provider with `MockCmsAdapter[_default_]`. When unset / empty, no fallback. |

`NEXT_PUBLIC_CMS_MOCK_DEFAULT_SITE` keeps its existing semantics (used by `MockCmsAdapter` directly when `NEXT_PUBLIC_CMS_PROVIDER=mock`). The new flag is orthogonal.

## 7. Test Strategy

**Pre-Impl Test (single commit, real-failing)**:
- `FallbackCmsAdapter.test.ts` — 6+ scenarios:
  - primary returns content → fallback NOT called
  - primary returns CMSNoResult → fallback called with `_default_` site, locale unchanged
  - both return CMSNoResult → CMSNoResult propagated
  - same matrix for `getLayout`, `getNavigation`
  - `hasContent`: OR of both
  - optional methods (handleWebhook) delegate to primary only

**Implementation commit**: `FallbackCmsAdapter` + DI wiring + `.env.template` default → tests green.

No browser-smoke this slice — pure service-layer wrapper, behavior is unit-testable.

## 8. ACs

- [ ] When `NEXT_PUBLIC_CMS_PROVIDER=storyblok` + `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER=mock` + Storyblok returns 404 on a slug → app renders the `_default_` mock content for that slug.
- [ ] When the primary provider returns content → no fallback call (verified via mock-spy in test).
- [ ] When `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER` is unset → no composite layer, behavior identical to today.
- [ ] `npm test` green, no Test-Vertrag-Drift on existing tests.
- [ ] `npm run build` green, no new edge-bundle imports.

## 9. Commit Plan

1. `test(cms/fallback): add composite adapter contracts` (pre-impl, failing)
2. `feat(cms/fallback): composite adapter with mock _default_ fallback` (implementation + env-template + docs)

## 10. Hard Rules (verbindlich)

1. NIE `git stash` (auch nicht `-u`), NIE worktree-Meta-Files.
2. Keine Task-Internals in Code/Commit-Messages (kein `Slice 9`, `SHOW-323`, `Variante`).
3. Edge-Bundle bleibt sauber — `FallbackCmsAdapter` lebt im Service-Layer, importiert keine SDK-Module direkt.
4. Sub-Agents im Background.
