# EMP-21 — Server-Only-Migration `NEXT_PUBLIC_CMS/STORYBLOK_*` → `NEXT_*` + Server-Actions

**Branch:** `feature/SHOW-323` (selber Worktree wie EMP-20) · **Issue:** EMP-21 · **Lead:** Architect
**Quelle:** Board-Reject f9df6e2b auf EMP-20 + `.claude/EMP-20-plan-step3-and-server-only-env.md` (Inventar bereits dort)
**Out of scope:** Browser-Smoke-Acceptance (EMP-20) und FU-001/2/3/4 sind eigene Tickets.

## Live-Status (Architect-Tracking)

- 2026-05-31 — Plan committed (lokal, intern). Phase A delegiert an `frontend-developer` (Sub-Agent, background). Test-Strategie für Phase B + C bei `testing-engineer` (Sub-Agent, background). Cross-Review-Chain wird sequenziell pro Phase ausgelöst, sobald Sub-Agent zurück meldet.
- Reihenfolge: A → A-CR → B-strategy → B-pre-impl-test → B-impl → B-CR → C-strategy → C-pre-impl-test → C-impl → C-CR → D → AK-Gate → Disposition.

### Phase A — done (Commit `485de80d`)
- 31 Files, 7 ENV-Keys renamed, `getPublicCmsLocalDefaultSite` → `getCmsLocalDefaultSite` in neuer Server-only-Datei `src/lib/server/cms-server-defaults.ts`.
- 1302/1302 Tests grün, tsc + lint + check-translations clean, Drift-Grep exit=0.
- Architect-Cross-Review (Stichproben): approved — ENV-Renames konsistent, `.env.template`-Kommentare präzise (per-Key „SERVER-ONLY"-Hinweis), Memory-konform (kein Phase-Marker im File-Body).
- testing-engineer-Cross-Review läuft (background, `a4b8837536955db2b`).
- Out-of-scope follow-up: `src/platform/services/cms/cms-cache.ts` enthält NUL-Bytes (binary diff seit HEAD~5+, nicht durch Phase A eingeführt).

### Test-Strategie für Phase B/C — done (`a37e34f3a2ee7cd41`)
- Klärungen vom Architect rückbeantwortet (siehe §3): Cross-Origin-Check entfällt (Next-15-CSRF deckt das), Token-Casing strict `=== 'true'`, `_actions/`-jest-config-Patch im selben Commit wie Pre-Impl-Test.
- Server-Action-Tests sollen ins **Library-Project** mit erweitertem testMatch.
- Stolperstein: ohne config-Patch wären Pre-Impl-Tests silent-skipped (Memory `test_orphaned-tests`).

### Phase A test cross-review — approved (0 Findings, `a4b8837536955db2b`)
- 6 Achsen geprüft: ENV-Backup-Pattern, Mock-Pfade, Setup-Files, E2E-Specs (nur doc-strings, korrekt), env-validation pin-list (Phase A required keine Updates — Phase C wird `OPTIONAL_ENV_VARS` aktualisieren), Integration-Test.

### Phase B Pre-Impl — done (Commit `07048221`)
- 9 failing tests committed: 6 server-action (`storyblok-bridge.test.ts`) + 3 bridge-bootstrap (`StoryblokBridgeScript.test.tsx`). 4 render-contract Tests bleiben grün als Baseline.
- jest.config.js gepatched für `**/app/_actions/**`-Glob (verhindert silent-skip).
- Stub-Action-File mit `throw new Error('not implemented')` (Architect Option A für tsc-Greenness).
- npm run jest: 9 failed / 1299 passed / 1308 total — kein Regression.

### Phase B Impl — done (Commit `3965dd00`)
- Action-Body: `await headers()` + URL-pathname-check `/preview/*` + warn-log pro deny-Pfad. Token bleibt `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` (Phase C migriert).
- Component: `useEffect` async mit `cancelled`-Guard + silent-catch für rejected promise. Kein ENV-Read mehr.
- 13/13 Phase-B acceptance grün, 1308/1308 full-jest grün, tsc + lint clean.
- **Architect-Klärung (2026-05-31, post-impl):** Logger über `@/platform/server` (nicht `@/platform/ssr`) — Server-Actions sind analog API-Routes, nicht RSC-cache-wrappers. Memory `[[feedback_server_action_uses_server_container]]` neu angelegt für künftige Briefs.
- Lazy-require von `@/platform/server` im Action-File: bestehendes Memory `[[feedback_platform_jest_server_adapter_imports_react_tree]]` (sub-agent-Memory) erweitert um neuen Trigger (server-action transitive-import → DI-bootstrap in node-env-platform-jest).

### Phase B Impl Cross-Review — 2 minor coverage-gaps gefunden + geschlossen
- testing-engineer (`af0384f5c69d15b10`): 0 Blocker, 2 minor (invalid-URL deny path uncovered + unmount-during-pending race uncovered), 1 nit (no action).
- Memory `feedback_cross_review_discipline` strict: Coverage-Gap-Schließung in eigenem Follow-up-Commit `faea9422` — NICHT auf Phase C verschoben.
- 1310/1310 grün. Phase B end-state: 0 Findings, approved.

### Phase C Pre-Impl — done (Commit `e2f3f72a`)
- 8 acceptance tests in `src/app/_actions/cms-banner.test.ts` + Stub-Action.
- use-banner.test.tsx refactor: Mock-Pfad gewechselt + ENV-PREVIEW-Backup entfernt + 2 source-audits + 1 deletion-guard.
- 14 failed (erwartet) / 1306 passed / 1320 total — kein Regression außerhalb Phase-C-Surface.
- Sub-Agent-Decision: `TopBannerData` als `{ story?: unknown }` (loose, Impl-Refine später); `export {}`-Marker gegen Test-File-Scope-Collision (Memory `feedback_test_files_module_scope` neu).

### Phase C Impl — done (Commit `aca9d9bb`)
- 16 Files modifiziert + 1 gelöscht (`storyblok-banner-api.ts`).
- Action-Body, Hook-Refactor, ENV-Rename atomar.
- 1320/1320 Tests grün, tsc + lint + check-translations clean, Drift-Grep 0 (zwei verbliebene Treffer sind Source-Audit-Pin-Negation, kein Reintroduction).
- **Architect-Cross-Review-Finding (blocker, post-impl):** SDK-Signatur ist `(opts) => (() => StoryblokClient)` — Accessor. Sub-Agent macht direkt `storyblokInit().get()` ohne Accessor-Invocation. Tests sind grün durch Mock-Reality-Mismatch (Mock liefert direkten Client, SDK liefert Accessor). Production wäre crash mit `api.get is not a function`. Beweis: `node_modules/@storyblok/react/dist/rsc.d.ts:139` + Bestandscode-Pattern `StoryblokCmsApi.ts:74-90`.

### Phase C Bugfix — done (Commit `3ea431dc`)
- Action umgestellt auf Accessor-Pattern (`accessor?.() ?? null`). Klare JSDoc-Verweise auf `node_modules/@storyblok/react/dist/rsc.d.ts:139` + Legacy-Pattern `StoryblokCmsApi.ts:74-90`.
- Test-Mocks aligned mit SDK-Realität (`mockReturnValue(() => client)` statt direkt `client`).
- 1 neuer defensiver Test: `accessor returns null client`.
- 1321/1321 grün, tsc + lint clean.
- Architect-Cross-Review (Diff): approved.

### Phase C Final Cross-Review (test-dimension) — 2 minors + 2 nits gefunden
- testing-engineer (`a66fe326578abe7df` + Re-Report): 0 Blocker, 2 minor (DI-touch-Pin im no-token-Pfad fehlt; Token-Leak-Source-Audit fehlt), 2 nit (parameterized strict-equals coverage; warn-log-shape-assertion).
- Sub-Agent empfahl Absorption in Phase D — Memory `feedback_cross_review_discipline` strict: Approve = 0 Findings für JEDE Severity. Daher: Close-out-Commit jetzt (`a16604cca451f5470`, in flight).

### Phase C Close-out — done (Commit `857c98b8`)
- 4 Test-Findings geschlossen (Minor 1 DI-touch-Pin, Minor 2 Token-Leak-Source-Audit, Nit 1 strict-equals matrix, Nit 2 warn-log-shape).
- cms-banner.test.ts 9→14, use-banner.test.tsx 7→8 (+6 total).
- 1327/1327 grün, tsc + lint clean.
- Phase C end-state: 0 Findings, approved.

### Phase D — done (Commit `261348b1`)
- ESLint `no-restricted-syntax` mit AST-Selector für `process.env.NEXT_PUBLIC_(STORYBLOK|CMS)_*`.
- `preview-smoke.sh` Browser-Bundle-Guard für 3 Needles (zwei Prefixes + Demo-Token-Sentinel).
- `docs/environment-variables.md` neue „Server-Only Migration"-Sektion (29 Zeilen, 9 Keys, beide Server-Actions, beide Guards).
- 1327/1327 grün, lint clean, tsc clean, bash-n grün.
- Cross-Review (frontend-developer, `a4b24c667156413fc`): 1 minor (AST-Loophole für computed-access + destructuring + aliased) + 6 nits (alle „keine Aktion nötig" laut Reviewer).
- Memory `feedback_cross_review_discipline` strict + Memory `feedback_do_it_right_over_quick_fix`: AST-Loophole-Close-out in eigenem Commit (`a58c4518b531ca585`, in flight).

### Phase D AST-Loophole-Close-out in flight — `a58c4518b531ca585` (background)
- testing-engineer ergänzt ESLint-Selector um Computed-Access + Destructuring-Pattern. Aliased-Indirektion bleibt out-of-AST — durch preview-smoke Bundle-Guard abgedeckt.

---

## 1. Context / Problem

`NEXT_PUBLIC_*`-Variablen werden zur Build-Zeit in den Browser-Bundle gebakt. Storyblok-Token, Space-ID, Cache-TTLs etc. landen damit in jedem Client-JS-Chunk — sichtbar für jeden Page-Visitor. Board-Anforderung: **Server-Only**. Wo der Browser den Wert wirklich braucht (Bridge-SDK init, Banner-Fetch), kommt er über **Server-Actions mit Access-Check**.

---

## 2. Schichten-Schnitt (Phase-bezogen)

### Phase A — trivial-rename (Server-only-by-usage)

| Datei | Layer | Änderung |
|---|---|---|
| `src/platform/services/cms/CmsProviderResolver.ts` | Service | `NEXT_PUBLIC_CMS_PROVIDER` → `NEXT_CMS_PROVIDER`, `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER` → `NEXT_CMS_FALLBACK_PROVIDER`. Token-Read (`NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`) bleibt in Phase A — fällt erst in Phase C |
| `src/platform/services/cms/CmsProviderResolver.test.ts` | Tests | Env-Setup mitziehen |
| `src/platform/services/cms/cms-cache.ts` | Service | `NEXT_PUBLIC_CMS_PAGE_CACHE_TTL_MS` → `NEXT_CMS_PAGE_CACHE_TTL_MS`, `NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS` → `NEXT_CMS_LAYOUT_CACHE_TTL_MS` |
| `src/platform/services/cms/cms-cache.test.ts` | Tests | Env-Setup mitziehen |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.ts` | Integration | `NEXT_PUBLIC_STORYBLOK_SPACE_ID` → `NEXT_STORYBLOK_SPACE_ID`, `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` → `NEXT_STORYBLOK_MULTI_SITE`. Token/Preview bleiben in Phase A — Phase C |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.test.ts` | Tests | Env-Setup mitziehen (3 ENVs auf einmal — `_TOKEN`/`_PREVIEW` bleiben unverändert, nur SPACE_ID/MULTI_SITE umbenannt) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.ts` | Integration | `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` → `NEXT_STORYBLOK_MULTI_SITE` |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.test.ts` | Tests | mitziehen |
| `src/platform/services/cms/impl/cms-webhook-cache.integration.test.ts` | Tests | mitziehen (`NEXT_PUBLIC_STORYBLOK_MULTI_SITE` → `NEXT_STORYBLOK_MULTI_SITE`) |
| `src/lib/common/public-default-env.ts` → **neue Datei** `src/lib/server/cms-server-defaults.ts` (`import 'server-only';`) | lib | `getPublicCmsLocalDefaultSite` umziehen + umbenennen zu `getCmsLocalDefaultSite`. ENV `NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE` → `NEXT_CMS_LOCAL_DEFAULT_SITE`. Konsumenten (`LocalJsonCmsAdapter`, `bind-active-cms-adapter`) auf neuen Import umschalten. **Begründung:** Funktion wird ausschließlich von Server-only Integration/Service genutzt; Verbleib in `public-default-env.ts` würde den falschen Eindruck eines Browser-fähigen Defaults konservieren |
| `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.ts` | Integration | Import umschalten |
| `src/platform/services/cms/bind-active-cms-adapter.ts` + Test | Service | Import umschalten + Test-Mock-Pfad |
| `src/platform/healthcheck/env-validation.ts` | platform | `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` (optional warning) bleibt in Phase A — fällt in Phase C. Phase A fügt NICHTS hinzu |
| `scripts/preview-smoke.sh` | scripts | `NEXT_PUBLIC_CMS_PROVIDER=${id}` → `NEXT_CMS_PROVIDER=${id}` |
| `.env.template` | env | 6 Keys umbenennen, Kommentar in CMS-Sektion aktualisieren („Phase A — Storyblok-Token-Migration in Phase C") |
| `docs/environment-variables.md` | docs | 6 Keys + Erklärungstext (warum nicht mehr `NEXT_PUBLIC_`) |

**Out of Phase A (bleibt vorerst):** `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`, `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW`. Diese werden in Phase C migriert (zusammen mit Server-Actions), weil sie noch echte Browser-Konsumenten haben (Bridge + Banner).

### Phase B — Server-Action Bridge

| Datei | Layer | Änderung |
|---|---|---|
| `src/app/_actions/storyblok-bridge.ts` (neu) | App-Action | `'use server'`. Export `getStoryblokBridgeConfig(): Promise<{ accessToken: string } \| null>`. Liest `process.env.NEXT_STORYBLOK_ACCESS_TOKEN` (bleibt in Phase B noch als `NEXT_PUBLIC_*` — Rename in Phase C). Access-Check siehe Sektion 3 |
| `src/app/_actions/storyblok-bridge.test.ts` (neu) | Tests | Unit-Test: Token wird nur bei passendem Referer ausgespielt; sonst `null` |
| `src/platform/integrations/storyblok/cms/impl/StoryblokBridgeScript.tsx` | Integration (Client-Component) | `useEffect`-Body von direktem `process.env`-Read auf `await getStoryblokBridgeConfig()` umstellen. Bei `null`: silent no-op |
| `src/platform/integrations/storyblok/cms/impl/StoryblokBridgeScript.test.tsx` | Tests | Mock auf Server-Action statt direktem `process.env` |

### Phase C — Server-Action Banner + Token-Migration

| Datei | Layer | Änderung |
|---|---|---|
| `src/app/_actions/cms-banner.ts` (neu) | App-Action | `'use server'`. Export `fetchTopBanner({ locale }: { locale: string }): Promise<BannerData \| null>`. Liest `NEXT_STORYBLOK_ACCESS_TOKEN` + `NEXT_STORYBLOK_ACCESS_PREVIEW` server-side. Storyblok-Client per Server-only Modul |
| `src/app/_actions/cms-banner.test.ts` (neu) | Tests | Unit-Test: token unset → `null`; token gesetzt → fetched story; preview=true → version=draft |
| `src/hooks/banner/use-banner.ts` | Hooks (Client) | `getStoryblokApi()`-Import + ENV-Read entfernen. Stattdessen `await fetchTopBanner({ locale })` im `useEffect`. Banner-Store + Loading/Error-Surface bleiben unverändert |
| `src/hooks/banner/use-banner.test.tsx` | Tests | Mock auf Server-Action, ENV-PREVIEW-Tests fallen weg (per Server-Action-Mock simuliert) |
| `src/hooks/banner/storyblok-banner-api.ts` | Hooks | **löschen** (kein Browser-Konsument mehr) |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.ts` | Integration | `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` → `NEXT_STORYBLOK_ACCESS_TOKEN`; `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` → `NEXT_STORYBLOK_ACCESS_PREVIEW` |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsApi.test.ts` | Tests | Env-Setup mitziehen |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.test.ts` | Tests | `originalToken`-Backup-Var umbenennen |
| `src/platform/services/cms/CmsProviderResolver.ts` | Service | Token-Read in `resolveCmsProvider` auf `NEXT_STORYBLOK_ACCESS_TOKEN` umstellen |
| `src/platform/healthcheck/env-validation.ts` | platform | `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` → `NEXT_STORYBLOK_ACCESS_TOKEN` |
| `src/platform/healthcheck/__tests__/env-validation.test.ts` | Tests | mitziehen |
| `src/app/_actions/storyblok-bridge.ts` (Phase B-Erweiterung) | App-Action | Token-Read auf `NEXT_STORYBLOK_ACCESS_TOKEN` umstellen |
| `.env.template` | env | 2 Keys + Hinweis „Server-only via Server-Action" |
| `docs/environment-variables.md` | docs | mitziehen + Verweis auf Server-Action-Architektur |

### Phase D — Drift-Tests + Hardening

| Datei | Layer | Änderung |
|---|---|---|
| `scripts/preview-smoke.sh` | scripts | Pro `BUILD_ID` zusätzlicher Browser-Bundle-Check: `grep -rc 'NEXT_PUBLIC_STORYBLOK_\|uvTlxgRrZDSUyr4zftdoNgtt\|NEXT_PUBLIC_CMS_' .next/static/chunks` MUSS `0` ergeben. Fail-Severity = wie Edge-Bundle-Guard |
| `eslint.config.mjs` | lint | `no-restricted-properties` für `process.env.NEXT_PUBLIC_STORYBLOK_*` (regexp). Verhindert Re-Introduction. Message verweist auf `NEXT_STORYBLOK_*` + Server-Action-Pattern |
| `docs/environment-variables.md` | docs | „Server-Only-Migration"-Sektion: warum kein `NEXT_PUBLIC_STORYBLOK_*` mehr, wie Browser auf den Wert kommt (Server-Action) |

---

## 3. Server-Action-Access-Check (Phase B Detail)

**Ziel:** der Bridge-Token darf nur an Browser-Code rausgehen, der tatsächlich auf einer `/preview/...`-Route eingebettet im Storyblok Visual Editor läuft. Kein Token-Leak via beliebiger Storefront-Page, die zufällig Bridge-Script mounted.

**Heuristik (in Reihenfolge ausgewertet):**

1. `headers().get('referer')` lesen → muss `URL(referer).pathname.startsWith('/preview/')` matchen.
2. Falls Referer fehlt / nicht matcht: `null` zurück + `logger.warn({ referer }, 'bridge-token denied')`.
3. **Kein** ENV-basierter Gate (Memory `[[feedback_no_global_env_for_per_request_state]]`).

**Architect-Klärung (2026-05-31, post-strategy):**

- **Cross-Origin-Check entfällt.** Begründung: Next 15 Server-Actions sind ab Werk CSRF-protected per Origin/Host-Check (`next.config` `actions.allowedOrigins`). Cross-origin-Submission wird vom Next-Server abgewiesen, bevor unser Action-Code überhaupt läuft. Ein zweiter `ownOrigin`-Check im Action-Body wäre redundant + bringt unnötige Quellen-Entscheidung (`NEXTAUTH_URL` vs. `headers().get('host')` + Protocol) ohne Sicherheitsgewinn. Path-Check + denied-warn ist ausreichend.
- **Server-Action liest in Phase B noch `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN`.** Token-Rename auf `NEXT_STORYBLOK_ACCESS_TOKEN` erfolgt in Phase C (atomisch über alle Lesepunkte). Das hält Phase B fokussiert auf den Pattern-Wechsel.

**Bewusst NICHT geprüft:**
- `sec-fetch-dest=iframe`: gilt für die Page-Request, nicht für die Server-Action-Request (Server-Action ist immer ein `fetch` → `sec-fetch-dest=empty`).
- HMAC der Storyblok-Editor-URL: FU-004, separat geplant.

**Effektiver Schutz:** Token kein Build-Inline mehr. Selbst wenn Access-Check umgangen wird (gleicher Origin + manueller Referer), liefert der Token nur Read-Only-CDN-Access auf die public Storyblok-Demo-Space. Der echte Gewinn ist: das Token landet nicht mehr in `.next/static/chunks/*.js`.

---

## 4. Server-Action-Pattern für Banner (Phase C Detail)

Banner ist public content (`cdn/stories/top-banner-announcement`). Kein Access-Gate nötig — die Server-Action ist nur **Token-Container**, damit der Token den Browser nie sieht. Verhalten:

```ts
// src/app/_actions/cms-banner.ts
'use server';

import 'server-only';
import { apiPlugin, storyblokInit } from '@storyblok/react/rsc';

export async function fetchTopBanner({ locale }: { locale: string }) {
  const token = process.env.NEXT_STORYBLOK_ACCESS_TOKEN?.trim();
  if (!token) return null;

  const api = storyblokInit({ accessToken: token, use: [apiPlugin] });
  if (!api) return null;

  const version = process.env.NEXT_STORYBLOK_ACCESS_PREVIEW === 'true' ? 'draft' : 'published';
  const response = await api.get('cdn/stories/top-banner-announcement', { version, language: locale });
  return response.data; // { story: { content: TopBannerAnnouncementContent } }
}
```

`use-banner.ts` ruft die Action im `useEffect`, schreibt das Resultat in den `useBannerStore` und exponiert `{ data, isLoading, error }`.

**Caching:** Server-Action ist nicht Next-cached (POST). Banner-Store macht weiterhin In-Session-Caching (`if (data) return early`). Bei Bedarf später `unstable_cache` einziehen — out of scope.

---

## 5. DI-Bindings

Keine. Server-Actions sind reine Module mit `'use server'`, kein Inversify-Binding.

---

## 6. ENV-Variablen (Soll-Zustand nach Migration)

| Neu | Alt | Bereich |
|---|---|---|
| `NEXT_STORYBLOK_ACCESS_TOKEN` | `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` | Server-only (Server-Action) |
| `NEXT_STORYBLOK_SPACE_ID` | `NEXT_PUBLIC_STORYBLOK_SPACE_ID` | Server-only |
| `NEXT_STORYBLOK_MULTI_SITE` | `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` | Server-only |
| `NEXT_STORYBLOK_ACCESS_PREVIEW` | `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` | Server-only (Server-Action) |
| `NEXT_CMS_PROVIDER` | `NEXT_PUBLIC_CMS_PROVIDER` | Server-only |
| `NEXT_CMS_FALLBACK_PROVIDER` | `NEXT_PUBLIC_CMS_FALLBACK_PROVIDER` | Server-only |
| `NEXT_CMS_LOCAL_DEFAULT_SITE` | `NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE` | Server-only |
| `NEXT_CMS_PAGE_CACHE_TTL_MS` | `NEXT_PUBLIC_CMS_PAGE_CACHE_TTL_MS` | Server-only |
| `NEXT_CMS_LAYOUT_CACHE_TTL_MS` | `NEXT_PUBLIC_CMS_LAYOUT_CACHE_TTL_MS` | Server-only |

---

## 7. Migration / Rückwärtskompatibilität

**Keine Backwards-Compat.** Die Umbenennung ist breaking für aktive Deployments (Vercel-ENV muss mitgezogen werden). Begründung: Sicherheits-Ziel ist genau, dass alte `NEXT_PUBLIC_*`-Werte **nicht** mehr aus Versehen funktionieren — sonst wäre der Build-Bundle-Guard hohl.

`.env.template` und `docs/environment-variables.md` dokumentieren das Rename explizit; Vercel-ENV-Update ist Deployment-Owner.

---

## 8. Test-Strategie

Test-Strategie pro Datei wird vom **testing-engineer** im Strategie-Modus zugeliefert, bevor Phase B/C startet. Pro Phase wird ein **failing acceptance test** vor der Implementation committed.

**Phase A** ist mechanisches Rename — Akzeptanz-Test = Drift-Grep (siehe AKs §10). Keine neuen Unit-Tests; bestehende Unit-Tests werden mit-renamed.

**Phase B / C** brauchen echte Akzeptanz-Tests (Server-Action-Contract + Hook-Integration). Test-Strategie holt der Architect beim testing-engineer ab.

**Phase D** Drift-Tests laufen als Browser-Bundle-Grep im preview-smoke + ESLint-Run.

---

## 9. Hand-off-Reihenfolge (sequenziell, mit Cross-Review)

1. **Phase A** — `frontend-developer` macht das mechanische Rename + Test-Anpassung. Vorher: kein testing-engineer-Strategy-Call nötig (kein neuer Test-Surface). Nach Implementation: `testing-engineer` Cross-Review auf Tests + Architect Cross-Review auf Code. Commit + Push.
2. **Phase B** — Architect → `testing-engineer` Strategy/Pre-Impl (failing acceptance test). → `frontend-developer` macht grün. → Cross-Review beidseitig. Commit + Push.
3. **Phase C** — Architect → `testing-engineer` Strategy/Pre-Impl. → `frontend-developer` macht grün + entfernt `storyblok-banner-api.ts` + zieht ENV-Rename mit. → Cross-Review beidseitig. Commit + Push.
4. **Phase D** — `testing-engineer` als Lead (Drift-Tests + ESLint-Regel). Architect Cross-Review. Commit + Push.
5. **Acceptance Gate** — Architect prüft AKs (§10) selbst, danach Disposition.

---

## 10. Akzeptanzkriterien (Issue 1:1 + Drift-Greps)

- [ ] `grep -rn 'NEXT_PUBLIC_STORYBLOK_\|NEXT_PUBLIC_CMS_' src/` zeigt **keine** Treffer (nicht „idealerweise leer" — hart leer; Reste müssen dokumentiert + begründet sein, aber Soll ist 0).
- [ ] `grep -c 'uvTlxgRrZDSUyr4zftdoNgtt\|NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN' .next/static/chunks/*.js` === `0` nach `next build`.
- [ ] Bridge funktioniert weiterhin im Storyblok Visual Editor (manueller Smoke gegen Demo-Space 338074 mit Token `uvTlxgRrZDSUyr4zftdoNgtt`).
- [ ] Top-Banner wird weiterhin angezeigt (manueller Smoke auf Startseite).
- [ ] `npm run jest` grün.
- [ ] `npx tsc --noEmit` grün (Pflicht-Gate gemäß Memory `feedback_tsc_gate_over_tests`).
- [ ] `npm run lint` grün (inkl. neuer `no-restricted-properties`-Regel).
- [ ] `scripts/preview-smoke.sh` grün (jetzt mit Browser-Bundle-Guard).

---

## 11. Verbindlich aus Memory

- `feedback_no_global_env_for_per_request_state` — Access-Check NICHT über ENV.
- `feedback_no_task_internals_in_code` — keine `EMP-21`/`Phase A` etc. im Code/Test-Titeln; nur in Commits + PR-Titel.
- `feedback_project_language_english` — Repo-Artefakte (inkl. neuer Server-Actions, ESLint-Message, Docs) auf **Englisch**. Diese Plan-Datei darf intern Deutsch bleiben.
- `feedback_cross_review_discipline` — Approve = 0 Findings. Jede Phase passiert beidseitiges Cross-Review.
- `feedback_tsc_gate_over_tests` — Architect prüft tsc selbst.
- `feedback_branch_and_pr_workflow` — falls EMP-21 als PR gepublisht wird, gilt das SHOW-323-Schema NICHT (EMP-21 ist eigene Story). Branch-Disposition wird beim Push entschieden.

---

## 12. Disposition nach Abschluss

`done` wenn AKs §10 grün. Wenn nur Plan committet (z. B. weil User vor Implementation reviewen will): `in_review` mit Verweis auf diese Datei.
