# Slice 7 — Webhook-Cache-Invalidation + Framework-Doku + Polish (konsolidiert, vormals 7+8)

> **Branch**: `feature/SHOW-323` (von gitea/feature/SHOW-323-target = Slice-5-Stand)
> **Vorgänger**: Slice 5 merged in target
> **Baseline**: 139 Suites / 1211 Tests
> **Modus**: Pro-Slice-Ablauf ohne User-CR ([[feedback_quality_gates_per_slice]])
> **Scope-Größe**: ~15-25 Files (Architekt-Schätzung, User-OK 2026-05-20)
> **Story-Status**: **letzter Slice von SHOW-323**. Nach Merge: finaler PR `target → master`.

## Goal

Webhook-getriebene Cache-Invalidation: wenn Storyblok (oder ein anderes CMS) eine Page/Layout publisht, wird der entsprechende Cache-Eintrag im Frontend gezielt invalidiert. Plus: Framework-Doku komplettieren (`docs/cms-framework.md` als Lernpfad für künftige Adapter-Implementierer). Plus: Polish (JSDoc-Lücken, Plan-File-Final-Update).

## Architekt-Entscheidungen (verbindlich)

| # | Entscheidung |
|---|---|
| **E1** | Signature-Validation **pro Adapter**. Adapter exposed `validateWebhookSignature(headers, body): boolean` als optionale SPI-Methode. Storyblok nutzt seinen `webhook-signature`-Header. Generic-Fallback im Catch-All: HMAC mit `NEXT_CMS_WEBHOOK_SECRET` als Bearer-Token-Equivalent (Hash-Verify im optional-Surface-Fallback). |
| **E2** | Cache-Invalidation **granular (slug-basiert)**. Adapter exposed `mapWebhookPayload(headers, body): WebhookEvent[]` (optional SPI). `WebhookEvent = { kind: 'page' \| 'layout', slug, locale?, site? }`. Cache invalidiert nur die betroffenen Tuple-Keys. Fallback-Broad-Invalidate nur wenn `mapWebhookPayload` `null` zurückgibt (nicht-erkannter Payload). |
| **E3** | Ein Catch-All `/api/cms/webhook`. Route delegiert an `cms.handleWebhook(request: NextRequest): Promise<NextResponse>`. Adapter-spezifische Logik (Signature + Payload-Mapping) kapselt im Adapter. Ein Endpoint = ein Webhook-Config-Eintrag pro Tenant. |
| **E4** | Webhook-Secret als **Server-only ENV** (`NEXT_CMS_WEBHOOK_SECRET`). Optional (wenn nicht gesetzt: Webhook ist deaktiviert, Route returnt 503 mit klarer Fehlermeldung). |
| **E5** | Doku: `docs/cms-framework.md` als primärer Eintrittspunkt für künftige Adapter-Implementierer (Adapter-Pattern, Layout-Konzept, Component-Map, Webhook-Hook). Plus `docs/cms-webhook-setup.md` mit Storyblok-Webhook-UI-Anleitung. Slice-Plan-Files in `.claude/` bleiben Implementation-History (nicht versioniert). |

## Scope (File-Inventar)

### Neu — Webhook-Layer

| Datei | Was |
|---|---|
| `src/app/api/cms/webhook/route.ts` | POST-Endpoint, delegiert an `cms.handleWebhook(request)` |
| `src/app/api/cms/webhook/route.test.ts` | Integration-Test (Mock-Service, Signature-Fail-Pfad, Granular-Invalidate-Pfad, Broad-Fallback) |
| `src/platform/services/cms/cache-invalidator.ts` | Orchestriert Page-Cache + Layout-Cache, exposed `invalidatePage(slug, locale, site)` + `invalidateLayout(layoutId, locale, site)` + `invalidateAll()` |
| `src/platform/services/cms/cache-invalidator.test.ts` | Tests pro Invalidate-Methode |
| `src/platform/services/cms/page-cache.ts` (falls noch nicht existiert) | Page-Cache analog zu Layout-Cache (Slice 5), `globalThis`-Pattern, TTL via ENV |
| `src/platform/services/cms/page-cache.test.ts` | TTL + Key-Isolation + Invalidate |

### Geändert — Service / SPI

| Datei | Änderung |
|---|---|
| `src/platform/services/cms/CMSService.d.ts` | `handleWebhook(request): Promise<NextResponse>` ergänzen |
| `src/platform/services/cms/CmsAdapter.d.ts` | `handleWebhook(request): Promise<{ status: number, body?: unknown }>` + optional `validateWebhookSignature` + optional `mapWebhookPayload` |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.ts` | `handleWebhook`-Delegation + Cache-Invalidate-Orchestrierung nach Adapter-Response |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.webhook.test.ts` | Tests für Signature-Verify-Pfad + Mapper-Pfad + Cache-Invalidate-Call |
| `src/platform/services/cms/impl/NullCmsAdapter.ts` | `handleWebhook`: returns `{ status: 503, body: { error: 'No CMS provider configured' } }` |
| `src/platform/services/cms/impl/NullCmsAdapter.test.ts` | Test ergänzt |
| `src/platform/integrations/mock/cms/impl/MockCmsAdapter.ts` | `handleWebhook`: no-op success in Dev (für Test-Webhooks via curl) |
| `src/platform/integrations/mock/cms/impl/MockCmsAdapter.webhook.test.ts` | Tests |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.ts` | `handleWebhook` mit `validateWebhookSignature` (HMAC gegen `webhook-signature`-Header) + `mapWebhookPayload` |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.webhook.test.ts` | Tests |
| `src/platform/services/cms/__tests__/CmsAdapter.contract.ts` | Contract-Suite-Erweiterung: `describe('handleWebhook', ...)` + optional surface checks für `validateWebhookSignature` + `mapWebhookPayload` |
| `src/platform/services/cms/layout-cache.ts` | `invalidate(layoutId, locale, site)` falls noch nicht da; export via cache-invalidator (Slice 5 hat schon `invalidate`-Surface, vermutlich nur Re-Export nötig) |

### Geändert — ENV / Healthcheck

| Datei | Änderung |
|---|---|
| `src/platform/healthcheck/env-validation.ts` | `NEXT_CMS_WEBHOOK_SECRET` als optional in `OPTIONAL_ENV_VARS` (severity: warning, message: "Webhooks disabled without this") |
| `src/platform/healthcheck/__tests__/env-validation.test.ts` | Test additiv für den neuen optional-key |
| `.env.template` | `NEXT_CMS_WEBHOOK_SECRET=` (leer, mit Erklär-Kommentar) |
| `src/lib/common/public-default-env.ts` | (nicht nötig — Secret ist Server-only, kein Public-Default) |

### Neu — Doku

| Datei | Inhalt |
|---|---|
| `docs/cms-framework.md` | Vollständige Framework-Doku: Adapter-Pattern, SPI-Methoden, Schema-Map, Pattern A für Pattern-A-Inseln, Layout-Konzept, Webhook-Hook, Storyblok-Adapter-Beispiel. **Primärer Eintrittspunkt für künftige Adapter-Implementierer.** |
| `docs/cms-webhook-setup.md` | Pro CMS: Webhook-URL, Secret-Setup, Storyblok-Webhook-Konfig-Screenshot-Beschreibung |

### Polish

| Datei | Änderung |
|---|---|
| `.claude/SHOW-323-plan.md` §18 | Slice 5 als DONE, Slice 7 als DONE markieren nach Merge; Lessons-Learned aus Slice 7 anhängen |
| JSDoc-Lücken | Scan auf fehlende JSDoc in Service-/Adapter-Files; pragmatisch füllen (max 5-10 minimale Ergänzungen) |
| FU-001/FU-002 Status | Verifizieren, dass beide noch in `.claude/follow-up-stories.md` stehen für post-SHOW-323 |

## Verhalten-Constraints (Decision 23)

- **Webhook-Endpoint ohne `NEXT_CMS_WEBHOOK_SECRET`**: returnt 503 mit klarer Fehlermeldung (kein Crash). Bestehende App ohne Webhook-Setup ist unverändert.
- **Storyblok-Webhook ohne Signature-Header**: returnt 401 (Unauthorized). Storyblok-Adapter rejected vor Cache-Invalidate.
- **Mock-Adapter-Webhook**: no-op success (für Dev-Tests). Cache-Invalidate ist effektiv leer, weil Mock-Adapter eh nicht cached (Fixture-Reload bei Server-Reload).
- **Cache-Invalidate-Semantik**: nur betroffene Tuple-Keys werden geräumt, andere Cache-Einträge bleiben (siehe Slice-5-Test "don't cache notfound" — gleiche Semantik-Familie).

## Quality Gates (alle 10 vor Push)

Siehe [[feedback_quality_gates_per_slice]]. Spezifika für Slice 7:

- **Gate 6 (Browser-Smoke)**: testing-engineer testet — Webhook-Path ist API-only (kein Browser-Render). Smoke verifiziert:
  - `curl -X POST http://localhost:3000/api/cms/webhook` ohne Secret → 503
  - `curl -X POST -H "webhook-signature: invalid" ...` → 401
  - `curl -X POST -H "webhook-signature: <valid-HMAC>" -d '<storyblok-payload>' ...` → 200 + Cache-Invalidate-Beleg im Server-Log
  - Plus: normale Mock-Page-Render weiter grün (kein Regress)
- **Gate 8 (Verhaltens-Pinning)**: Cache-Invalidate-Operationen sind durch Unit-Tests gepinnt (granular = nur Target-Key weg, andere intakt)
- **Test-Count-Erwartung**: 139 Suites + ~4-6 neue Suites → 143-145 Suites

## Stop-and-Ask-Lagen

- **HMAC-Algorithmus**: Storyblok dokumentiert SHA-1 oder SHA-256 (je nach Konfig). Default-Pin auf SHA-256 (sicherer). Bei expliziter Storyblok-Doku-Abweichung → Stop-and-Ask.
- **Cache-Invalidate beim Page-Cache (Slice-1)**: falls Page-Cache noch nicht existiert (nur Layout-Cache aus Slice 5), muss er neu gebaut werden. Aufwand klein, kein Stop-and-Ask.

## Hand-off

1. testing-engineer Strategie-Modus → Test-Strategie pro File + Browser-Smoke-Curl-Plan
2. testing-engineer Pre-Implementation-Modus → failing Akzeptanz-Tests (`describe.skip`)
3. frontend-developer Build-Modus → iterativ pro File
4. Cross-Review-Loop (Architect + testing-engineer parallel, bis 0 Findings)
5. Architect Push (auf `feature/SHOW-323`) + PR-Update (PR #2 wurde gemerged — neuer PR mit head=`feature/SHOW-323`, base=`feature/SHOW-323-target`)
6. User mergt
7. **Finale Story-Aktion**: PR `feature/SHOW-323-target → master` für User-Final-Acceptance

## Lessons-Learned-Anhang

### Build-Phase (frontend-developer, 2026-05-20)

- **`NextRequest.clone()` muss `as NextRequest` gecastet werden**: `Request.prototype.clone()` ist typed to return `Request`, nicht `NextRequest`. Im Service haben wir `request.clone() as NextRequest`. Funktional ist das ein No-Op (NextRequest extends Request), aber TypeScript verlangt den Cast für die nachgelagerte `cloned.headers`-Verwendung — `Request.headers` ist bereits ausreichend, aber wir nutzen `cloned` auch in der `mapWebhookPayload`-Stelle wo wir uns auf NextRequest-Form verlassen wollten. Hätte sich vermeiden lassen indem der Service `mapWebhookPayload` mit `Headers` (nicht `NextRequest`) aufruft — was am Ende auch passiert.
- **`NextResponse.json(body, { status: 204 })` wirft**: Status 204 verbietet einen Response-Body (HTTP-Standard). Tests, die 204 verwenden, müssen den Body weglassen ODER auf 200 wechseln. Habe das im Webhook-Test entdeckt und auf 200 + body null umgestellt.
- **SPI-Typ-Widening von `NextRequest` zu `Request`**: Habe initial `handleWebhook?(request: NextRequest)` typisiert. Contract-Suite (`__tests__/CmsAdapter.contract.ts`) baut Standard-`Request` via `new Request(...)` und das verträgt sich nicht. Umgestellt auf `Request`. NextRequest ist Subtyp von Request, also war das ein einfaches Widening — und für den Adapter spielt keine Rolle ob NextRequest oder Request, da nur `text()` und `headers` verwendet werden.
- **HMAC `timingSafeEqual` braucht Length-Guard**: `crypto.timingSafeEqual` wirft bei ungleichen Buffer-Längen statt `false` zurückzugeben. Length-equal-Short-Circuit ist VOR dem Compare nötig, damit die Funktion nie wirft. Architekt-Entscheidung E1 (Constant-Time-Compare) pinning per Source-Audit-Test.
- **Prettier formatierte `'x-extra': ' '` zu Whitespace-Header-Value mit Newline**: Header-Werte mit Whitespace werden von der WHATWG-Fetch-Implementation rejected. Tests müssen sinnvolle Werte verwenden statt Whitespace-Token.
- **Bestehende `DelegatingCmsServiceSSR.test.ts` musste angepasst werden**: Service-Konstruktor bekam zweiten Parameter `LoggerService`. `sed -i ''` für alle `new DelegatingCmsServiceSSR(adapter)` → `new DelegatingCmsServiceSSR(adapter, silentLogger())` über beide Test-Files (`.test.ts` + `.layout.test.ts`). Plus jeweils ein `silentLogger`-Helper hinzugefügt.

### Phasing-Anmerkungen

- **6 Phasen statt 4**: das Plan-File enthielt 6 Phasen, die Briefing-Email aber 6. Habe streng nach dem Plan-File / Briefing-Email gearbeitet. P1 (caches) → P2 (SPI + Service) → P3 (Storyblok) → P4 (route + env) → P5 (docs). P6 (polish) ist hier als Final-Check.
- **Test-Stub → Real-Tests**: alle 6 vom testing-engineer gelieferten Stubs wurden auf echte Tests aufgeflippt. Endstand: 0 skipped suites.

### Test-Count-Trajektorie (Engineer)

| Phase | Commit | Suites | Tests |
|---|---|---|---|
| Baseline | 68e21cf | 139 + 6 skipped = 145 | 1211 + 24 skipped = 1235 |
| P1 | a892442 | 141 + 4 skipped = 145 | 1236 + 17 skipped = 1253 |
| P2 | 1ca3a01 | 143 + 2 skipped = 145 | 1266 + 9 skipped = 1275 |
| P3 | 84ab709 | 144 + 1 skipped = 145 | 1286 + 5 skipped = 1291 |
| P4 | bad58c3 | 145 + 0 skipped = 145 | 1299 + 0 skipped = 1299 |
| P5 | d658311 | 145 + 0 skipped = 145 | 1299 + 0 skipped = 1299 |
