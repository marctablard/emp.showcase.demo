---
name: emp22-preview-layout-test-paths
description: EMP-25 pre-impl acceptance test for the preview-route layout provider stack — path, jest-project routing, RED reasons, what EMP-24 must turn green.
metadata:
  type: project
---

EMP-25 (Tests für [[phasef-preview-test-paths]]-Folge EMP-22) committet failing acceptance für das Preview-Layout.

- **Test:** `src/app/preview/[site]/[locale]/[[...slug]]/__tests__/layout.test.tsx` (RTL, jsdom). Dynamic import via `@/`-Alias (kein relativer `../layout`).
- **Contract:** Layout muss Production-Provider-Kette replizieren: `AuthSessionProvider → SiteProvider → NextIntlClientProvider → StoreProvider` + `SiteThemeStyle`/`CsrfProvider`/`SiteSessionAligner`; `notFound()` bei Locale-Mismatch UND `getSite()→null`; toleriert `getSessionForSite()→null` (AC-4); excludet `CmsBridgeScript`/`Toaster`/`Notification`/dialog-Slot (plan §3 untere Liste).
- **RED gegen EMP-15-Stub:** `3 failed, 2 passed`. Rot = volle Kette (kein html/body), getSite-null→notFound (Stub ruft getSite nicht), Session-null→StoreProvider (Stub mountet keinen). Grün = Locale-Mismatch-notFound (Stub kann das schon) + Exclusion-Guard (trivial).
- **STEP-3 Happy-Path (AC-1):** schon als env-gated E2E `e2e/preview-route.spec.ts:146-166` (200 + Bridge). NICHT angefasst — Nachweis per Smoke mit `E2E_PREVIEW_SIGNED_URL`, nicht `npm run jest` (siehe [[e2e-env-gate-documentation]]).
- **Provider-Order-Assertion:** Pass-Through-Stubs mit `data-provider="<name>"` + `toContainElement`-Nesting. `mockNotFound.mockImplementation` in beforeEach wg. [[global-resetallmocks-strips-impl]].
- Commit `70f7410f`. EMP-24 (Frontend Dev Impl) entblockt.
