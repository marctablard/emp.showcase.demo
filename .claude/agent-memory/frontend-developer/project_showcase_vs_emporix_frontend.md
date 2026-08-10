---
name: project-showcase-vs-emporix-frontend
description: Strukturelle Unterschiede zwischen den Schwester-Repos emporix-showcase und emporix-frontend relevant für SHOW-323-Port (Stand 2026-05-26).
metadata:
  type: project
---

Showcase und emporix-frontend sind Schwester-Repos derselben B2B-Commerce-Codebase. Showcase ist der ältere Stand mit unportierter Storyblok-Integration; emporix-frontend hat SHOW-323 (CMS-Adapter-Framework) bereits durchgezogen.

**Why:** Wir portieren SHOW-323 von emporix-frontend nach showcase. Konfliktzone ist die bestehende showcase-Storyblok-Implementation, die durch das neue CMS-Adapter-Framework ersetzt wird.

**How to apply:** Bei jeder Port-Aufgabe folgende Showcase-spezifische Vorbelastungen mitdenken:

- **Struktur Top-Level**: Identisch (`src/{app,components,hooks,stores,providers,platform,lib,i18n,...}`). tsconfig.json, eslint.config.mjs, next.config.ts gleiches Schema. Aliases `@/*`, `@platform/*`, `@extensions/*` identisch.
- **Showcase-only Files** (Konflikt-Zone): `src/lib/storyblok.ts` (eager `storyblokInit()` mit `process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`, crasht ohne Token), `src/providers/StoryblokProvider.tsx` (global gemounted in `src/app/[site]/[locale]/layout.tsx`), `src/components/cms/storyblok/{storyblok-cms-page.tsx,storyblok-component.tsx}`, `src/components/cms/local/local-cms-page.tsx`, `src/hooks/banner/use-banner.ts` (direkter SDK-Call im Browser), `src/stores/banner-store.ts`, `docs/{local-cms.md,storyblok-components.md,storyblok-integration.md}`.
- **emporix-frontend-only**: `src/platform/integrations/storyblok/` (gesamter Adapter-Stack), `src/components/cms/{_core,_shared,layout,content-slot,theme}/`, `src/components/theme/`, jest-Mocks (`next-auth-react.js`, `product-tile.js`, `product-tile-skeleton.js`), `jest/mocks/README.md`, `docs/{cms-framework.md,cms-webhook-setup.md,mock-cms.md}`. Auch `src/platform/{server.ts,ssr.ts}` (showcase hat sie nicht; `@/platform/server`/`@/platform/ssr`-Imports werden in showcase aus `src/lib/{server,ssr}` resolved — d.h. Path-Mapping ist anders).
- **CMS-Components flach vs. tief**: Showcase hat `src/components/cms/<name>.tsx` (default-export, lose Props mit `any`). emporix-frontend hat `src/components/cms/<name>/{schema.ts,<name>.tsx,index.ts,*.test.tsx}` (Slice-2/3/4-Ergebnis). Showcase `cms-component-renderer.tsx` ist `'use client'` mit `dynamic()`; emporix-frontend hat keine separate Renderer-Datei mehr.
- **CMSService-Vertrag**: Showcase `CMSService.d.ts` hat nur `getPage(slug, locale, site)`. emporix-frontend hat Adapter-SPI: `CmsAdapter.d.ts`, `CmsPreviewAdapter.d.ts`, `CmsProviderResolver`, `DelegatingCmsServiceSSR`, `FallbackCmsAdapter`, `NullCmsAdapter`, contract+drift Tests. Showcase-impl: nur `LocalCMSServiceSSR.ts`. 
- **Stores**: Identisches Zustand-Pattern. Einziger Unterschied: showcase hat extra `banner-store.ts` (gehört zur alten Storyblok-Banner-Pipeline).
- **Hooks**: Identische Domain-Struktur. Showcase hat extra `hooks/banner/` (alte Storyblok-Banner).
- **Providers**: Identisch + showcase-extra `StoryblokProvider.tsx`.
- **jest**: Configs sind in showcase **minimal**. emporix-frontend hat (a) CMS-Component-Test-Routing in "React Tests"-Project, (b) `next-intl`/`use-intl` ESM-`transformIgnorePatterns`+swc-Transform in Platform-Project, (c) `next-auth/react`/`product-tile`/`product-tile-skeleton`-Mocks, (d) `matchMedia`/`IntersectionObserver`/`ResizeObserver`-Polyfills im react.setup.js, (e) `NEXT_PUBLIC_CMS_PROVIDER=storyblok`-Default-Seeding in beiden Setups. Alle (a–e) sind Teil des Ports.
- **ENV-Template**: Showcase hat `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` (client-bundle-exposed), `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW`, `NEXT_PUBLIC_STORYBLOK_MULTI_SITE`. emporix-frontend hat `STORYBLOK_ACCESS_TOKEN` (server-only umbenannt), kein `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` (Preview via `/preview/`-Route), zusätzlich `NEXT_PUBLIC_CMS_PROVIDER`, `NEXT_PUBLIC_CMS_MOCK_DEFAULT_SITE`, `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER=mock`, `NEXT_CMS_WEBHOOK_SECRET`.
- **API-Routes**: Showcase `src/app/api/cms/route.ts` ist generischer GET-Endpoint via `ssr.get<CMSService>('CMSService')`. emporix-frontend hat zusätzlich `src/app/api/cms/webhook/` + `route.test.ts`.
- **Showcase-Eigenheiten ohne Port-Bezug**: `NEXT_PUBLIC_DIALOGS_CLOSE_ON_OUTSIDE_CLICK` ENV (Dialog-Behaviour) + zugehörige Dialog/Input-UI-Anpassungen. `package.json` v1.3.0 vs 1.4.0, husky lint-staged hook ohne eslint --fix.

**Slice-Anwendbarkeit (kurz)**: 
- Slice 1 (Krash-Fix + Plugin-Foundation): 1:1 anwendbar; Showcase-Startup-Bug existiert hier identisch (`src/lib/storyblok.ts`).
- Slice 2 (Component-Co-Location): Migration ist von "flach" → "subdir-per-block" — der Ausgangszustand stimmt mit showcase überein. Aber: `src/components/cms/local/` und `src/components/cms/cms-component-renderer.tsx` (showcase-only) müssen zusätzlich entfernt werden; in emporix-frontend war das schon weg.
- Slice 3/4 (Adapter-Pipeline + StoryblokServerComponent-Removal): Ausgangs-Files (`storyblok-cms-page.tsx`, `storyblok-component.tsx`) sind 1:1 vorhanden.
- Slice 5–9 (Theming/Webhook/Preview/Mock-CMS/Default-Fallback): rein additiv im showcase, geringe Konflikt-Fläche.
- jest-Setup-Änderungen (Polyfills, Mocks, Routing, ESM-Transform) sind Cross-cutting — kommen vermutlich verteilt in Slice 2/3/4 mit.
