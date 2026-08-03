---
name: showcase-vs-frontend-test-env
description: Differences in test environment between emporix-showcase (SHOW-323 worktree) and emporix-frontend.git source repo as of 2026-05-26 orientation
metadata:
  type: project
---

`emporix-showcase` is the port target for SHOW-323. The current showcase state is the *pre-port* baseline (no CMS-adapter framework, no per-site theming, no webhook, no preview route).

**Why:** the port plan must account for missing test infrastructure (mocks, drift-tests, render-page contracts) and missing CMS test-files. Some source tests rely on env / module names / file paths that don't exist yet in showcase.

**How to apply:** when SHOW-323 patches land in showcase, expect to also port:
- `jest/mocks/next-auth-react.js`, `product-tile.js`, `product-tile-skeleton.js`, `README.md` (only `server-only.js` currently exists in showcase)
- `jest.platform.setup.js` env-default `NEXT_PUBLIC_CMS_PROVIDER=storyblok`
- `jest.react.setup.js` jsdom polyfills: `matchMedia`, `IntersectionObserver`, `ResizeObserver`
- `jest.config.js` React-Tests project additions: `components/cms/**`, `platform/**/*.render-page.test.tsx`, `platform/integrations/storyblok/cms/components/**` testMatches plus the `^@/components/product/product-tile(-skeleton)?$` moduleNameMapper entries and the `^next-auth/react$` moduleNameMapper
- `jest.config.js` Platform-Tests `transformIgnorePatterns: ['/node_modules/(?!(next-intl|use-intl)/)']` plus `@swc/jest` JS transform for ESM
- `docs/cms-framework.md`, `docs/cms-webhook-setup.md`, `docs/mock-cms.md`, `docs/adr/0001-cms-adapters-own-their-render-path.md`

**Frontend CMS test surface to port (~52 files):**
- spi-shape drift: `CmsAdapter.spi-shape.drift.test.ts`, `CmsPreviewAdapter.spi-shape.drift.test.ts`
- middleware drift: `middleware-no-direct-storyblok-import.drift.test.ts`, `ui-layer-no-storyblok-import.drift.test.ts`, `app-preview-no-storyblok-import.drift.test.ts`, `public-cms-routes-static-drift.test.ts`
- middleware preview rewrite contract: `src/lib/__tests__/middleware-preview-rewrite.test.ts`
- preview route render: `src/lib/__tests__/preview-route.test.tsx`
- preview registries: `preview-detector-registry.test.ts`, `preview-adapter-registry.test.ts`
- adapter-owned render-page contracts: `*.render-page.test.tsx` for Mock, Storyblok, StoryblokPreviewAdapter
- webhook contracts: `MockCmsAdapter.webhook.test.ts`, `StoryblokCmsAdapter.webhook.test.ts`, `DelegatingCmsServiceSSR.webhook.test.ts`, `app/api/cms/webhook/route.test.ts`
- container-init-order drift, schema.import drift per CMS block
- Storyblok behaviour-pin mapper test (richtext schema/renderer/mapper consistency — see [[richtext-schema-vs-renderer-split]])
- breadcrumb helper: `cms-page.breadcrumb.test.tsx`, `build-breadcrumb.test.ts` (note [[cms-breadcrumb-provider-coupled]] — needs SDK-decoupling in showcase too)

**Showcase CMS state today (pre-port):**
- Single legacy CMS service: `LocalCmsServiceSSR` (DI-bound, JSON files under `src/data/cms/_default_/<locale>/<slug>.json`)
- Single API route: `src/app/api/cms/route.ts` (GET only, no webhook, no preview)
- No adapter framework, no preview route, no `/preview/...` rewrite in `src/site/middleware.ts`
- No CMS-specific test files exist (`find src -path '*cms*' -name '*.test.*'` returns empty)
- Components under `src/components/cms/` are flat files (hero.tsx, video.tsx, etc.) — frontend has them under per-component subfolders with co-located tests

**E2E delta:**
- `e2e/cms-no-token.spec.ts` exists in frontend (AC#1 boot proof, gated on `E2E_CMS_NO_TOKEN`), missing in showcase
- `homepage.spec.ts`, `auth-site-sync.spec.ts`, `login-dialog-register.spec.ts` are byte-identical
- playwright.config.ts: showcase uses `npm run dev` + `/api/health` liveness probe and full devices/projects matrix (chromium+firefox+webkit). Frontend stripped this down to a minimal config running only `npm run dev:next` against `localhost:3000` root with no projects.

**Smoke-test gap (`next build && next start`):**
- showcase `package.json`: `build` = `generate && next build && check-translations && lint`, `start` = `next start`. No combined production-smoke script.
- No CI workflow runs `next start` against E2E. `github-actions-deploy-pr-preview.yaml` runs `jest` only; deploys via Vercel CLI.
- Live-edge-runtime smoke pattern from emporix-frontend memory ("Tests gegen Live-Edge-Runtime, nicht nur Mocks") has no equivalent script/CI in showcase. This is a gap to call out in the port plan.

**Test count delta:** showcase ~92 test files, frontend ~192 (+100 from SHOW-323 surface).

**1:1 portable tests:**
- All `*.drift.test.ts` source-text audits (path-based, repo-structure-driven)
- All adapter contract / SPI-shape tests (independent of site data)
- All `*.behaviour-pin.test.tsx` (DOM-level invariants per mapper)
- `e2e/cms-no-token.spec.ts` (gated, env-driven)

**Needs showcase-specific adaptation:**
- `auth-site-sync.spec.ts` — already identical, but depends on `E2E_LOGIN_EMAIL/PASSWORD` test tenants — showcase tenants may differ from frontend (verify `.env.test` site code mapping `main` ↔ "Showcase", `us-branch` ↔ "US")
- Middleware tests assume `/preview/...` rewrite exists in `src/site/middleware.ts` — file is present in both repos but showcase middleware does not implement preview yet
- Breadcrumb helper test ([[cms-breadcrumb-provider-coupled]]) — must be ported with the agnostic rewrite, not the SDK-coupled original
- Schema-import drift tests assume per-component schema files in `src/components/cms/<block>/schema.ts` — showcase still has flat structure, so either the source restructures showcase first or the drift-test paths shift
- Mock CMS adapter tests assume `MockCmsAdapter` (id `mock`) — showcase only has `LocalCmsServiceSSR`, see [[local-adapter-is-mock]]

Related: [[storyblok-preview-env]], [[https-dev-server]], [[preview-route-published-fallback]], [[no-direct-instantiation-audit]], [[deletion-guard-pattern]], [[editor-rewrite-segment-count]]
