---
name: phaseg-fallback-test-paths
description: EMP-16 Phase G FallbackCmsAdapter + bind-active-cms-adapter pre-impl test paths, jest-routing, get-cms-service contract change.
metadata:
  type: project
---

EMP-16 Phase G (SHOW-323) — CMS default-content fallback layer. Pre-Impl-Tests geschrieben (RED).

**Test-Files (alle Jest-Projekt "Platform Tests", node-env, KEIN jsdom):**
- `src/platform/services/cms/impl/FallbackCmsAdapter.test.ts` (NEU) — Behaviour-Matrix mit jest.fn-Stub-Adaptern. RED: Cannot find module './FallbackCmsAdapter'.
- `src/platform/services/cms/CmsProviderResolver.test.ts` (ERWEITERT additiv) — `resolveCmsFallbackProvider`-Matrix. RED: not a function. Bestehende resolveCmsProvider-Tests bleiben grün.
- `src/platform/services/cms/bind-active-cms-adapter.test.ts` (NEU) — Container-Mock (Vorbild get-cms-service.test). RED: Cannot find module './impl/FallbackCmsAdapter' + './bind-active-cms-adapter'.
- `src/platform/services/cms/get-cms-service.test.ts` (UMGESCHRIEBEN — siehe unten).

**get-cms-service Vertragsverschärfung (Abweichung von Architect "4 Tests grün halten"):**
Die alten 4 Tests pinnten alte Binding-Mechanik direkt am Container (toService('CmsAdapter:storyblok'/'none')). Phase-G verlagert die Binding-Entscheidung KOMPLETT in `bindActiveCmsAdapter`. Wenn get-cms-service delegiert (und bindActiveCmsAdapter gemockt ist), kann der Container nicht mehr selbst binden → alte Assertions strukturell unhaltbar ohne Logik-Duplikation. Daher umgeschrieben: not-bound-Zweig pinnt "bindActiveCmsAdapter(container) genau 1x, dann get('CMSService')"; already-bound pinnt "bindActiveCmsAdapter NICHT aufgerufen". Binding-Regeln selbst voll in bind-active-cms-adapter.test abgedeckt.

**Wichtige Pins (rutschige Design-Stellen):**
- Fallback wird IMMER mit fallbackSite ('_default_') befragt, NIE mit Original-site. Jeder getPage/getLayout/getNavigation-Delegations-Test asserted das explizit.
- Optional-Surface (handleWebhook/getEditableProps/BridgeScript): presence-mirrored vom PRIMARY only; delegiert exklusiv an primary; fallback-Surface NIE aufgerufen (Spy). Primary-omit → composite-Member undefined.
- bind-active-cms-adapter.test: FallbackCmsAdapter NICHT gemockt (instanceof-Check braucht echte Klasse). server-only via jest.mock('server-only',()=>({})). public-default-env + CmsProviderResolver gemockt.

Model-Typen liegen unter `src/platform/services/model/cms` (relativ aus impl/: `../../model/cms`). CmsAdapter ist `.d.ts`.
