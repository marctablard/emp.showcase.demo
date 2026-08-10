---
name: show323-phase-c-curl-masks-500
description: Phase-C browser-smoke — plain curl `/` returns 200 but real browser (Accept text/html) got 500 from the module-graph split; FIXED by getCmsService() lazy-bind helper (commit a63ebfbf).
metadata:
  type: feedback
---

SHOW-323 Phase-C: CMS-Pages gaben **500** auf `/` für echte Browser-Requests (`Accept: text/html` / Playwright), obwohl `curl -s /` (default `Accept: */*`) 200 lieferte. Ursache: `instrumentation.ts` bindet den `CmsAdapter`-Alias auf `server.default`/`ssr.default`, aber im `next start` Production-Build sieht der RSC-Render-Pfad eine andere Container-Instanz (Turbopack module-graph split, vgl. [[feedback_di_container_module_graph_split]]) → `DelegatingCmsServiceSSR` resolved frisch, `@inject('CmsAdapter')` findet nichts → `No bindings found for service: "CmsAdapter"` (digest war 3036062089, 16283-byte error-HTML, kein `<main>`).

**Fix (commit a63ebfbf, behoben):** `src/platform/services/cms/get-cms-service.ts` — `server-only` Lazy-Bind-Helper, der den SSR-Container am Call-Site resolved, `CmsAdapter` idempotent auf `CmsAdapter:<resolveCmsProvider(env)>` aliased (Fallback `CmsAdapter:none`/NullCmsAdapter wenn target unbound) und `CMSService` zurückgibt. ALLE render-path CMSService-Resolver migriert: `cms-page.tsx`, `[...slug]/page.tsx::generateMetadata`, `layout.tsx` (`.BridgeScript`), `api/cms/route.ts`. `instrumentation.ts`-Alias bleibt als server-container-Pfad. NullCmsAdapter ist via `@injectable('CmsAdapter:none','Singleton')` registriert (mein alter Notiz-Stand "kein NullAdapter" war veraltet). Bind silent on success — kein Log-Beweis, gerenderter Content ist der Beweis.

**Browser-Smoke-Beweis (alle 3 Modi, `Accept: text/html`, `next start`):**
- Modus 1 (kein token/provider): 200, `<main>`-inner **70 bytes** (leerer NullAdapter-Slot), E2E cms-no-token 1 passed.
- Modus 2 (`NEXT_PUBLIC_CMS_PROVIDER=local`): 200, `<main>`-inner **8489 bytes** / 19 Nodes (LocalJson gerendert).
- Modus 3 (`storyblok` + token): 200, `<main>`-inner **4052 bytes** / 17 Nodes, echter Storyblok-Content ("Welcome to Emporix Storyblok-Showcase"), `/api/cms?slug=home` liefert Storyblok-Delivery-JSON, **0** `blok=`-Leak.

**How to apply:** (1) Browser-Smoke IMMER mit `-H "Accept: text/html"` ODER Playwright — reine `curl /`-200 ist KEIN AC-Beweis. (2) `<main>`-inner-Längen-Kontrast (70 vs 8489 vs 4052 bytes) ist der saubere Beweis "leerer vs gefüllter Slot"; via `python3` `re.search(r'<main[^>]*>(.*?)</main>')`. (3) Storyblok-Content kann auf lokale Placeholder-Images (`/images/no_image.png`) zeigen → KEIN `a.storyblok.com`-CDN-URL bedeutet NICHT Fallback; Text-Marker + `/api/cms`-JSON prüfen. (4) Mit den worktree-`.env`-Emporix-Creds (tenant `medienwerftdemo`) resolved `/` jetzt voll, kein 404 mehr wie in [[feedback_show323_e2e_home_404_emporix_auth]]. Vorzustand: [[feedback_show323_storyblok_token_present_alias_unbound]].
