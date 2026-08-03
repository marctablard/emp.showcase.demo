# SHOW-323 — Plan v3 (Strategie F: Reimplementation, 7 Phasen)

> **Ersetzt** v1 (Strategie D — 180-Commit-Rebase) und v2 (Strategie E — Squash-Port).
> v1, v2 bleiben als Archiv erhalten.

## 1. Strategie

**Reimplementierung** von SHOW-323 (CMS-Adapter-Framework + Per-Site-Theming + Webhook + Preview-Route) im showcase-Repo mit hybrid-TDD-Workflow. Das Quell-Repo `emporix-frontend` ist verbindliche [[feedback-source-repo-as-spec-by-example]] — keine Code-Quelle, sondern Lese-Referenz.

Pro Phase: Architect plant gegen showcase-Bestand + Quell-Referenz → `testing-engineer` schreibt failing Akzeptanz-Tests → `frontend-developer` macht grün → beidseitiges Cross-Review → PR auf Gitea (`head=feature/SHOW-323` / `base=feature/SHOW-323-target`) → User-Review → Merge.

## 2. Quell-Referenzen (Pflicht pro Phase)

| Asset | Pfad |
|---|---|
| Quell-Bare | `/Users/mhammer/Projekte/emporix/emporix-frontend.git` |
| Quell-Worktree | `/Users/mhammer/Projekte/emporix/emporix-frontend.git/worktrees/SHOW-323` |
| Quell-Ref im showcase-bare | `imported/SHOW-323` @ `744bdb8` (für `git show imported/SHOW-323:<file>`) |
| Slice-Story-Specs | `.claude/SHOW-323-slice-{1..9}.md` (+ `6.3`, `6.3-recut`, `6.4`, `8-preview-route`, `9-default-fallback`) |
| ADRs | `docs/adr/0001-cms-adapters-own-their-render-path.md`, `docs/cms-framework.md` (im Quell-Repo) |

## 3. Branch- & Remote-Topologie

```
develop                       ← Default, unangetastet
  └─ feature/SHOW-323-target  ← Akkumulations-Branch
       └─ feature/SHOW-323    ← Arbeits-Branch
```

| Remote | Rolle |
|---|---|
| `gitea` (`git@gitea-local:Emporix/emporix-showcase.git`) | **Primär** — alle Pushes + PRs |
| `origin` (`git@github.com:emporix/emporix-showcase.git`) | **Gesperrt** bis Letzt-Merge + User-Freigabe ([[feedback-port-phase-remote-isolation]]) |

## 4. Schätzung (KI-Team-Geschwindigkeit, [[feedback-ki-team-estimation]])

**5–7 Compute-Tage, 6–9 Wallclock-Tage** für volle Reimplementierung mit hybrid-TDD und User-Reviews pro Phase.

## 5. Phasen-Mapping

| # | Phase | Enthaltene Slice-Specs | Compute h | Reihenfolge-Constraint | Status |
|---|---|---|---|---|---|
| **A** | Foundation | Vor-Slice 0 + Slice 1 | 5–8 | — | ✅ merged (PR #1) |
| **B** | Co-Location (Pilots) | Slice 2 (6 Pilots inkl. article) | 6–8 | nach A | ✅ merged (PR #2) |
| **B'** | Co-Location (Rest) | Slice 3 (14 Komponenten) | 6–9 | nach B | ✅ merged (PR #3) |
| **C** | Adapter-Pipeline + Cleanup + **Doku** | Slice 4 + ADR/Doku-Übernahme | 6–9 | nach B' | ✅ merged (PR #4) |
| **D** | Layout-Pipeline + Banner-Migration + Per-Site-Theming | Slice 5 + Theming-Anteil aus Slice 6 (siehe Mapping-Korrektur) | 6–8 | nach C | ✅ code merged in `feature/SHOW-323` (`c9917d91`, `0cd49e6b` — EMP-13/EMP-18) |
| **E** | Webhook + HMAC + Cache-Invalidation + Framework-Doku | Slice 7 (vormals 7+8 konsolidiert) | 4–6 | nach D | ✅ code merged in `feature/SHOW-323` (`14679c66` — EMP-14) |
| **F** | Preview-Route (provider-agnostic, SPI-Split) | Slice 8 + deferred Browser-Smoke (EMP-20) | 4–6 | nach C (Middleware), Live-Edge-Smoke Pflicht ([[feedback-test-real-edge-runtime]]) | ✅ code merged in `feature/SHOW-323` (`6e6be746`, `92e7fe12` — EMP-15/EMP-20) |
| **G** | Composite-Default-Content-Fallback + Production-Build-Smoke + Phase-G-Review-Fix | Slice 9 (composite default-content fallback) | 3–5 | nach E + F | ✅ code merged in `feature/SHOW-323` (`6bbd1862`, `9103f1de` — EMP-16) |

**Mapping-Korrektur 2026-05-29:** Slice 6 (Per-Site-Theming) ist im Slice-5-AC-6 mit-implementiert (User-OK 2026-05-20). Slice 7 ist semantisch Webhook+Cache, gehört zu Phase E (nicht D wie ursprünglich im Plan).

**Mapping-Korrektur 2026-05-30 (Phase G):** Phase G hat das Composite-Default-Content-Fallback-Pattern (Slice 9) implementiert — anders als in v3 zuvor notiert ist das Composite-Pattern in der Vorlage gespec't und wurde übernommen. Phase G enthält zusätzlich: Production-Build-Smoke (`next build && next start` mit Storyblok + local + none) und den Phase-G-Review-Fix (Smoke env-guard parity, Instrumentation- + Composite-Fallback-Tests, CI-Visibility). Hardening + Drift-Guards + Healthcheck-Hooks aus dem ursprünglichen EMP-9-Scope sind zu Phase G migriert worden.

**Scope-Korrektur 2026-05-31 (User-Wake aa3509c5):** **FU-003 (Tailwind v4 Utility-Layer vs. `<button>`/`<a>` Browser-Defaults) ist NICHT Teil von EMP-2/SHOW-323.** FU-003 wird als eigenes Ticket separat beauftragt (noch nicht bestätigt). Dieser Umbrella endet mit Phase G; finaler Schritt ist Aggregat-PR `feature/SHOW-323-target` → `develop` auf Gitea/Origin nach User-Freigabe.

**Provider-Naming:** Spec-by-Example aus `emporix-frontend` zeigt `mock` als Provider-ID. Im showcase **bleibt `local`** (User-Entscheidung, [[feedback-local-provider-stays]]). Slice-5-File-Inventory ist in dieser Hinsicht zu übersetzen, nicht 1:1 zu übernehmen.

### Phase-C Doku-Aufgabe (Pflicht, sonst toter `ADR 0001`-Verweis bleibt)

`jest.config.js` referenziert bereits 2× `ADR 0001`, das Dokument fehlt aber im showcase. Phase C zieht nach (alles **Englisch**, [[feedback-project-language-english]]):
- `docs/adr/0001-cms-adapters-own-their-render-path.md` (aus `imported/SHOW-323` adaptiert) — Adapter-Architektur
- **`docs/adr/0002-cms-component-co-location-and-schema-first.md` (NEU, nicht in Vorlage)** — dokumentiert das Komponenten-Pattern aus Slice 2+3: Co-Location-Struktur, Naming-Konvention, React-freie schema.ts, HTMLAttributes-Spread+cn, Server-First+Client-Islands, component-map/-schema-Registrierung + Drift-Guard, z.lazy()-Container + Side-Effect-Import. Konsequenz: vorhersehbarer File-Satz pro Komponente, type-safe, drift-geschützt, mehr Boilerplate (bewusst). Architect schreibt das ADR (Architektur-Doku, kein TDD).
- `docs/cms-framework.md` (CMS-Adapter-Architektur)
- `docs/local-cms.md` → durch `cms-framework.md` ablösen/aktualisieren
- `docs/cms-webhook-setup.md` und `docs/mock-cms.md` kommen mit ihren jeweiligen Phasen (E bzw. D)
- Breiteres Architectural-Review (ADRs für nicht-SHOW-323-Code) ist **separate Initiative**, nicht Teil von Phase C.

## 6. Pro-Phase-Mechanik (Pflicht)

1. **Pre-Phase-Disziplin** ([[feedback-quality-gates-per-slice]]): MEMORY.md + relevante Slice-Plan-Files + Quell-Implementation lesen
2. **Architect-Plan**: Phase-spezifischer Plan mit Files-Liste, ACs, Quell-Pfade
3. **testing-engineer (failing acceptance tests)**: schreibt + committet ROTE Tests gegen die ACs
4. **frontend-developer (build)**: implementiert, macht Tests grün, dokumentiert Pre-Implementation-Audits
5. **Cross-Review**: Architect (Schichten/DI/ENV) + Test-Engineer (Test-Vollständigkeit/AC) — 0 Findings Pflicht ([[feedback-cross-review-discipline]])
6. **Push** `feature/SHOW-323` → gitea (NIE origin)
7. **PR eröffnen** in Gitea-UI/API: `head=feature/SHOW-323`, `base=feature/SHOW-323-target`
8. **User-Code-Review** in Gitea
9. **Merge** in Gitea → `feature/SHOW-323-target` ist um die Phase erweitert
10. **Sync** `feature/SHOW-323` auf neuen target-Stand vor nächster Phase

## 7. Quality Gates pro Phase

1. Pre-Phase-Disziplin gelesen
2. Files exakt nach Plan, keine ungeplanten Side-Edits
3. `npm run jest` grün
4. `npm run lint` grün
5. `npm run build` grün (Phase F zusätzlich `next start` Live-Smoke)
6. `grep -rE "SHOW-323|Slice|Phase [A-G]|RE-CUT|Pattern [A-Z]|DR-|PR-#" src/ docs/ tests/ e2e/` = 0 Hits außer in `.claude/` und `docs/adr/` ([[feedback-no-task-internals-in-code]])
7. Sub-Agent Cross-Review = 0 Findings
8. Gitea-PR-Review = approved
9. Merge auf `feature/SHOW-323-target`
10. `feature/SHOW-323` rebased/synced

## 8. Phase A — Foundation (Detail)

### Ziel
- App startet & rendert Home **ohne** `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` (Slice-1 AC #1)
- `CmsAdapter`-SPI + `DelegatingCmsServiceSSR` + Provider-Resolver etabliert
- `NullCmsAdapter` (Default), `LocalJsonCmsAdapter` (portiert aus `LocalCMSServiceSSR.ts`)
- Storyblok-Nutzer-Flow bit-identisch (Token gesetzt → existing pages funktionieren)
- Setup-Files-Modernisierung (jest, mocks, .env.template-Doku)

### Out-of-Scope
- Token-Rename `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` → `STORYBLOK_ACCESS_TOKEN` — kommt erst in späterer Phase (frühestens C, wenn Storyblok-SSR-Direct-Imports weg sind)
- StoryblokCmsAdapter / `cms-page.tsx`-Renderer-Refactor → Phase C
- Co-Location der CMS-Components → Phase B
- Banner via API-Route → Phase D
- Per-Site-Theming → Phase D

### Vor-Slice 0 Teil (Setup-Files)

**Pure File-Lifts** aus `imported/SHOW-323` (keine TDD-Pflicht für reine Infrastruktur-Files):
- `jest.config.js` — Erweiterungen: CMS-testMatches, `transformIgnorePatterns` für `next-intl`/`use-intl`, `@swc/jest`-Transform, `testPathIgnorePatterns` (Doppellauf-Vermeidung), `moduleNameMapper`-Einträge für `product-tile`/`product-tile-skeleton`/`next-auth/react`
- `jest.platform.setup.js` — `NEXT_PUBLIC_CMS_PROVIDER=storyblok` Default-Seed
- `jest.react.setup.js` — jsdom-Polyfills (`matchMedia`, `IntersectionObserver`, `ResizeObserver`)
- `jest/mocks/next-auth-react.js`, `jest/mocks/product-tile.js`, `jest/mocks/product-tile-skeleton.js`, `jest/mocks/README.md` — neu
- `.env.template` — `NEXT_PUBLIC_CMS_PROVIDER`, `NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE` dokumentieren

**Verifikation**: alle bestehenden showcase-Tests bleiben grün, nichts gebrochen.

### Slice 1 Teil (siehe `.claude/SHOW-323-slice-1.md` Sektionen 3–12)

**Files neu** (16 Files):
- `src/platform/services/cms/CmsAdapter.d.ts`
- `src/platform/services/cms/CmsProviderResolver.ts` + `.test.ts`
- `src/platform/services/cms/__tests__/CmsAdapter.contract.ts` (Helper, kein direkter Test)
- `src/platform/services/cms/impl/DelegatingCmsServiceSSR.ts` + `.test.ts`
- `src/platform/services/cms/impl/NullCmsAdapter.ts` + `.test.ts` + `.contract.test.ts`
- `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.ts` + `.test.ts` + `.contract.test.ts`
- `src/platform/services/model/cms/navigation.d.ts` (neu, statt Stub in `cms-content.d.ts`)
- `src/hooks/banner/use-banner.test.tsx`
- `e2e/cms-no-token.spec.ts`

**Files geändert** (15 Files):
- `src/platform/services/cms/CMSService.d.ts` (erweitert; **OHNE** `getBanner` — Cleanup-Stand)
- `src/platform/services/model/cms/cms-content.d.ts` (CMSBanner gelöscht, CMSNavigation moved)
- `src/platform/services/cms/impl/LocalCMSServiceSSR.ts` (`@injectable` raus, `providerId='local'` Tightening — bleibt als Dead Code für Phase B)
- `src/platform/depency.yml`
- `src/instrumentation.ts`
- `src/lib/storyblok.ts` (Lazy/Conditional Token-Guard)
- `src/providers/StoryblokProvider.tsx` (Conditional Render)
- `src/components/cms/storyblok/storyblok-cms-page.tsx` (Graceful null)
- `src/hooks/banner/use-banner.ts` (Graceful null)
- `src/platform/healthcheck/env-validation.ts` (Storyblok-Token → OPTIONAL, severity `warning`)
- `src/platform/healthcheck/__tests__/env-validation.test.ts` (erweitert)
- `src/lib/common/public-default-env.ts` (Defaults)
- `next.config.ts` (`NEXT_PUBLIC_CMS_PROVIDER` durchreichen)

### Akzeptanzkriterien Phase A

- [ ] `npm run jest` grün, neuer Test-Count signifikant höher als showcase-Baseline
- [ ] `npm run lint` grün
- [ ] `npm run build` ohne Storyblok-Token → exit 0
- [ ] `npm start` ohne Token → Home liefert HTTP 200, kein `access token`-Console-Error
- [ ] `CmsService = DelegatingCmsServiceSSR` resolved gegen NullAdapter (kein `CMS_PROVIDER`) bzw. LocalJsonAdapter (`CMS_PROVIDER=local`)
- [ ] Mit gesetztem Token: bestehende Storyblok-Pages bit-identisch verhalten
- [ ] `e2e/cms-no-token.spec.ts` (env-gated, `E2E_CMS_NO_TOKEN=true`) grün
- [ ] Quality Gate 6 (Task-Internals-Grep) = 0 Hits

## 9. Risiken & Annahmen

1. **Container-Bootstrap-Reihenfolge**: `instrumentation.ts`-Aliasing könnte zu spät laufen — Fallback via Side-Effect-Module in `server.ts`/`ssr.ts`. Im Pre-Implementation-Audit final klären.
2. **`scripts/di-generator.ts`** muss nach jeder Phase laufen — `src/platform/{server,ssr,client}.ts`-Diff prüfen, sonst Adapter-Bindings still tot.
3. **`getStoryblokApi`-Call-Site-Audit** in Phase A: vor Implementation `rg -n "getStoryblokApi|@/lib/storyblok" src/` — alle Caller müssen graceful null behandeln.
4. **package.json**: showcase v1.3.0, kein Versions-Bump in Phasen A–G — separate Entscheidung nach G.
5. **playwright.config.ts**: showcase-Variante (3-Browser-Matrix, webServer auto-start) behalten — Quell-Variante NICHT übernehmen.
6. **Test-Daten / Tenants**: `auth-site-sync.spec.ts`-env-Tenants in Phase D/F prüfen.

## 10. Status

- [x] Sub-Agent-Inventur (frontend-developer + testing-engineer)
- [x] Plan v1 (Strategie D) archiviert
- [x] Plan v2 (Strategie E) archiviert
- [x] Plan v3 geschrieben (diese Datei)
- [x] Gitea-Remote + `master` + `develop` gepusht
- [x] `feature/SHOW-323-target` von `develop` angelegt + Gitea-Push
- [x] `feature/SHOW-323` Gitea-Push
- [x] `imported/SHOW-323`-Ref im showcase-bare gefetched
- [x] **Phase A — Foundation** — merged (PR #1)
- [x] **Phase B — Co-Location (Pilots)** — merged (PR #2)
- [x] **Phase B' — Co-Location (Rest)** — merged (PR #3)
- [x] **Phase C — Adapter-Pipeline + Cleanup + Doku** — merged (PR #4)
- [x] **Phase D — Layout + Banner + Per-Site-Theming** — code in `feature/SHOW-323` (`c9917d91`, `0cd49e6b`)
- [x] **Phase E — Webhook + HMAC + Cache-Invalidation** — code in `feature/SHOW-323` (`14679c66`)
- [x] **Phase F — Preview-Route (SPI-Split)** — code in `feature/SHOW-323` (`6e6be746`, `92e7fe12`)
- [x] **Phase G — Composite-Fallback + Production-Build-Smoke + Review-Fix** — code in `feature/SHOW-323` (`6bbd1862`, `9103f1de`)
- [ ] Phasen D–G: Gitea-PRs gegen `feature/SHOW-323-target` finalisieren + Merge (per Phase)
- [ ] **User-Freigabe Origin-Push**
- [ ] Letzt-Merge `feature/SHOW-323-target` → `develop` als single aggregate PR (Gitea, anschließend Origin nach Freigabe)
- [ ] Cleanup: `imported/SHOW-323` löschen, ggf. Quell-Tags entfernen

**Aus Scope dieses Umbrellas raus (eigene Tickets):**
- **FU-001** — `data-testid`-Helper-Convention (siehe `.claude/follow-up-stories.md`)
- **FU-002** — E2E-Coverage CMS-Komponenten via Fixture-Page (siehe `.claude/follow-up-stories.md`)
- **FU-003** — Tailwind v4 Utility-Layer vs. `<button>`/`<a>` Browser-Defaults (siehe `.claude/follow-up-stories.md`). _Per User-Wake 2026-05-31 (Comment aa3509c5) NICHT Teil von EMP-2; eigene Beauftragung steht aus._
- **FU-004** — HMAC-Preview-Token-Verify (Security medium, aus `SHOW-323-summary.md` §12)
