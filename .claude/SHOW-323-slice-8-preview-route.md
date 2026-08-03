# Slice 8 — Agnostische `/preview/`-Route via CMS-Preview-SPI

## 1. Context / Problem

Heute ist die Preview-Pipeline provider-spezifisch:

- **App-Route** `src/app/editor/[site]/[locale]/[[...slug]]/page.tsx` ruft den Storyblok-SDK direkt (über den Adapter-Layer-Wrapper `storyblok-sdk-render.ts`, sauber). Die Route selbst kennt aber den Begriff "editor" — ein Storyblok-Terminus.
- **Middleware** `src/site/middleware.ts` ruft `isStoryblokEditorRequest(req.nextUrl)` direkt aus dem Integration-Layer (`@/platform/integrations/storyblok/cms/impl/storyblok-editor-detection`). Das ist eine harte Schicht-Verletzung: UI/Routing → Integration-Layer.
- **Konstante** `EDITOR_ROUTE_PREFIX = '/editor'` in der Middleware kodiert eine provider-spezifische Pfad-Konvention.

Konsequenz: Ein neuer CMS-Adapter (Sanity, Contentful, Storyblok-V2) kann seine Preview-Brücke **nicht** anschließen, ohne die Middleware + die App-Route zu editieren. Das ist genau das, was die 3-Schicht-Architektur verhindern soll.

### Ziel

UI- und Routing-Schicht sind provider-frei. Jeder CMS-Adapter exportiert seine Preview-Detection + Preview-Render-Pipeline über einen klar definierten SPI. Eine **einzige** agnostische App-Route (`/preview/...`) und ein **einziger** Middleware-Path-Block bedienen alle Adapter.

### Out of scope

- Per-Site-Theming (eigener Slice).
- Erweiterung des SPI um Webhook-Preview-Token-Validation (Slice 7 hat das vertikal abgeschlossen).
- Live-Edit-Wrapper / Bridge-Script-Mechanik (bleibt unverändert; Wrapper ist Adapter-intern).

## 2. Schichten-Schnitt

### 2.1 Neue Files (Production)

**Wichtige Architektur-Anpassung (nach Test-Strategie-Review)**: Die Factory wird in zwei Files gesplittet (edge-safe Detector / node-only Renderer). Adapter werden ebenfalls in zwei Files gesplittet, damit die Edge-Bundle-Middleware nicht das SDK einzieht.

| Datei                                                                                              | Layer       | Runtime    | Zweck                                                                                       |
|----------------------------------------------------------------------------------------------------|-------------|------------|---------------------------------------------------------------------------------------------|
| `src/platform/services/cms/CmsPreviewAdapter.d.ts`                                                 | Service     | both       | SPI-Interface für Preview-Pfad (kein DI). Enthält `CmsPreviewDetector` als Sub-Interface.   |
| `src/platform/services/cms/preview/preview-detector-registry.ts`                                   | Service     | edge-safe  | Factory `getPreviewDetector(env)` — importiert **nur** Pure-Detection-Functions             |
| `src/platform/services/cms/preview/preview-adapter-registry.ts`                                    | Service     | node-only  | Factory `getPreviewAdapter(env)` — importiert vollen Adapter inkl. Renderer (SDK)           |
| `src/platform/integrations/storyblok/cms/preview/storyblok-preview-detection.ts`                   | Integration | edge-safe  | Pure Function `isStoryblokPreviewRequest(url)` — refactored aus `storyblok-editor-detection`|
| `src/platform/integrations/storyblok/cms/preview/StoryblokPreviewAdapter.ts`                       | Integration | node-only  | Voller Storyblok-Preview-Adapter (id + detection-re-export + renderer mit SDK)              |
| `src/platform/integrations/mock/cms/preview/MockPreviewAdapter.ts`                                 | Integration | both       | Mock-Adapter — `isPreviewRequest` false, `renderPreviewPage` null (Caller-Fallback)         |
| `src/app/preview/[site]/[locale]/layout.tsx`                                                       | UI/Routing  | node       | Agnostischer Preview-Layout-Slot                                                            |
| `src/app/preview/[site]/[locale]/[[...slug]]/page.tsx`                                             | UI/Routing  | node       | Agnostische Preview-Page — ruft `getPreviewAdapter()` mit Fallback auf published-Pfad       |

### 2.2 Geänderte Files

| Datei                                                          | Änderung                                                                                                              |
|----------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------|
| `src/site/middleware.ts`                                       | `EDITOR_ROUTE_PREFIX = '/editor'` → `export const PREVIEW_ROUTE_PREFIX = '/preview'`. Direkt-Import von `storyblok-editor-detection` durch Aufruf von `getPreviewDetector(env)?.isPreviewRequest(url)` ersetzen. Middleware importiert **nur** den edge-safe Detector-Registry, NICHT den vollen Adapter-Registry. |

### 2.3 Entfernte Files

| Datei                                                          | Grund                                                                                                 |
|----------------------------------------------------------------|-------------------------------------------------------------------------------------------------------|
| `src/app/editor/[site]/[locale]/layout.tsx`                    | Ersetzt durch agnostischen `/preview/`-Layout                                                         |
| `src/app/editor/[site]/[locale]/[[...slug]]/page.tsx`          | Ersetzt durch agnostische `/preview/`-Page                                                            |
| `src/platform/integrations/storyblok/cms/impl/storyblok-editor-detection.ts` | Refactored zu `preview/storyblok-preview-detection.ts` (Function-Rename + neue Location)|
| `src/platform/integrations/storyblok/cms/impl/storyblok-editor-detection.test.ts` | Test wandert mit Detection-Function nach `preview/storyblok-preview-detection.test.ts`         |
| `src/lib/__tests__/editor-route.test.tsx`                      | Test wird umgeschrieben auf `preview-route.test.tsx`                                                  |
| `src/lib/__tests__/middleware-editor-rewrite.test.ts`          | Test wird umgeschrieben auf `middleware-preview-rewrite.test.ts`                                      |

### 2.4 Neue Tests

| Datei                                                                                                                | Zweck                                                                                  |
|----------------------------------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------|
| `src/platform/services/cms/CmsPreviewAdapter.spi-shape.drift.test.ts`                                                | SPI-Shape-Drift-Guard für `CmsPreviewAdapter` + `CmsPreviewDetector` (Member-Audit)    |
| `src/platform/services/cms/preview/preview-detector-registry.test.ts`                                                | Edge-safe Factory-Dispatch (storyblok / mock / none) + Referenzgleichheit              |
| `src/platform/services/cms/preview/preview-adapter-registry.test.ts`                                                 | Node-only Factory-Dispatch (storyblok / mock / none) + Referenzgleichheit              |
| `src/platform/integrations/storyblok/cms/preview/storyblok-preview-detection.test.ts`                                | Pure-Function-Test (migriert aus `storyblok-editor-detection.test.ts`)                 |
| `src/platform/integrations/storyblok/cms/preview/StoryblokPreviewAdapter.render-preview-page.test.tsx`               | Storyblok-Preview-Render: SDK-Wrapper + Bridge + null bei Validation-Failure           |
| `src/platform/integrations/mock/cms/preview/MockPreviewAdapter.test.ts`                                              | Mock-Adapter: `isPreviewRequest` deterministisch false, `renderPreviewPage` null       |
| `src/lib/__tests__/preview-route.test.tsx`                                                                           | App-Route-Vertical-Test: Adapter-Render + Published-Fallback bei null + notFound       |
| `src/lib/__tests__/middleware-preview-rewrite.test.ts`                                                               | Middleware-Rewrite-Logik mit neuer Detector-Pipeline + pass-through für `/preview/*`   |
| `src/lib/__tests__/app-preview-no-storyblok-import.drift.test.ts`                                                    | Drift-Guard AC-1: `src/app/preview/**` darf kein `@storyblok/*` direkt importieren     |
| `src/lib/__tests__/middleware-no-direct-storyblok-import.drift.test.ts`                                              | Drift-Guard AC-2: `src/site/middleware.ts` darf nicht aus `@/platform/integrations/storyblok/**` importieren |

## 3. Interfaces

```typescript
// src/platform/services/cms/CmsPreviewAdapter.d.ts
import type { ReactElement } from 'react';
import type { CmsProviderId } from './CmsProviderResolver';

/**
 * Edge-safe sub-contract: detection only. Pure, synchronous, no I/O,
 * no process.env read, no SDK dependency. Designed to be safely
 * imported inside Edge-runtime middleware.
 */
export interface CmsPreviewDetector {
  readonly id: CmsProviderId;
  isPreviewRequest(url: URL): boolean;
}

/**
 * Full preview-pipeline contract. Extends the detector with the
 * node-runtime-only render path. Implementations live in the
 * integration layer; the integration package may pull in heavy SDK
 * code here — that's why this contract MUST NOT be imported from
 * Edge-runtime code paths.
 */
export interface CmsPreviewAdapter extends CmsPreviewDetector {
  /**
   * Renders the preview page for the given route segments. Returns null
   * when the adapter cannot fulfill the request (e.g. validation failed,
   * story not found, token missing). Caller falls back to the standard
   * public route in that case.
   */
  renderPreviewPage(params: {
    slug: string;
    locale: string;
    site: string;
    url: URL;
  }): Promise<ReactElement | null>;
}
```

```typescript
// src/platform/services/cms/preview/preview-detector-registry.ts
// EDGE-SAFE: imports ONLY pure detection functions. NO SDK code reachable
// through this module-graph. Middleware uses this registry.
import { resolveCmsProvider, type CmsProviderId } from '../CmsProviderResolver';
import type { CmsPreviewDetector } from '../CmsPreviewAdapter';
import { storyblokPreviewDetector } from '@/platform/integrations/storyblok/cms/preview/storyblok-preview-detection';
import { mockPreviewDetector }      from '@/platform/integrations/mock/cms/preview/mock-preview-detection';

export function getPreviewDetector(env: NodeJS.ProcessEnv = process.env): CmsPreviewDetector | null {
  const providerId: CmsProviderId = resolveCmsProvider(env);
  switch (providerId) {
    case 'storyblok': return storyblokPreviewDetector;
    case 'mock':      return mockPreviewDetector;
    case 'none':      return null;
  }
}
```

```typescript
// src/platform/services/cms/preview/preview-adapter-registry.ts
// NODE-RUNTIME ONLY: imports full adapter (incl. SDK render). App-Router
// pages use this registry. Do NOT import from Edge-runtime middleware.
import 'server-only';
import { resolveCmsProvider, type CmsProviderId } from '../CmsProviderResolver';
import type { CmsPreviewAdapter } from '../CmsPreviewAdapter';
import { storyblokPreviewAdapter } from '@/platform/integrations/storyblok/cms/preview/StoryblokPreviewAdapter';
import { mockPreviewAdapter }      from '@/platform/integrations/mock/cms/preview/MockPreviewAdapter';

export function getPreviewAdapter(env: NodeJS.ProcessEnv = process.env): CmsPreviewAdapter | null {
  const providerId: CmsProviderId = resolveCmsProvider(env);
  switch (providerId) {
    case 'storyblok': return storyblokPreviewAdapter;
    case 'mock':      return mockPreviewAdapter;
    case 'none':      return null;
  }
}
```

### Adapter-Modul-Struktur (Storyblok)

```
src/platform/integrations/storyblok/cms/preview/
├── storyblok-preview-detection.ts          # Pure function + Detector-Export (edge-safe)
├── storyblok-preview-detection.test.ts     # Unit-Tests für Pure Function
├── StoryblokPreviewAdapter.ts              # Voller Adapter (re-exports Detector + Renderer + id)
└── StoryblokPreviewAdapter.render-preview-page.test.tsx
```

`storyblok-preview-detection.ts` exportiert:
- `isStoryblokPreviewRequest(url: URL): boolean` (Pure Function)
- `storyblokPreviewDetector: CmsPreviewDetector` (Modul-Singleton, `{ id: 'storyblok', isPreviewRequest: isStoryblokPreviewRequest }`)

`StoryblokPreviewAdapter.ts` exportiert:
- `storyblokPreviewAdapter: CmsPreviewAdapter` (`{ ...storyblokPreviewDetector, renderPreviewPage }`)

Mock-Adapter analog gesplittet:
- `mock/cms/preview/mock-preview-detection.ts` — `mockPreviewDetector` (immer false)
- `mock/cms/preview/MockPreviewAdapter.ts` — `mockPreviewAdapter` (renderPreviewPage → null)

## 4. DI-Bindings

Keine. Der gesamte Preview-Pfad läuft an InversifyJS vorbei — static module imports, durch eine Factory dispatched. Begründung:

1. **Edge-Runtime-Kompatibilität**: Middleware läuft in der Next-Edge-Runtime; der InversifyJS-Container ist Node-Runtime-only.
2. **Frühe Render-Phase**: Die `/preview/`-Page wird gerendert, bevor `instrumentation.ts` Aliasse setzt — Side-Effekt-freie Module-Resolution ist hier zuverlässiger als DI-Resolver.
3. **Closed Set**: Provider-IDs sind in `CMS_PROVIDER_IDS as const` zentralisiert. Ein neuer Provider hinzufügen heißt: einen `case` in der Factory ergänzen, alles andere ist typed.

## 5. ENV-Variablen

Keine neuen ENV. `resolveCmsProvider(env)` greift unverändert auf `NEXT_PUBLIC_CMS_PROVIDER` + `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` als Auto-Detect-Hinweis zu.

Wichtige Abgrenzung gemäß [[feedback_no_global_env_for_per_request_state]]:
- ENV antwortet auf **„Welcher Provider ist überhaupt aktiv?"** (build-time / runtime, app-weit).
- `isPreviewRequest(url)` antwortet auf **„Ist DIESER konkrete Request ein Preview?"** (request-time, aus `url.searchParams` / Headers).

Keine ENV-Variable steuert Preview-Verhalten pro Request.

## 6. Middleware-Refactor (Edge-Runtime)

```typescript
// src/site/middleware.ts (skizziert; final wird der Developer schreiben)

// vorher:
import { isStoryblokEditorRequest } from '@/platform/integrations/storyblok/cms/impl/storyblok-editor-detection';
const EDITOR_ROUTE_PREFIX = '/editor';
if (!path.startsWith(EDITOR_ROUTE_PREFIX) && isStoryblokEditorRequest(req.nextUrl)) { ... }

// nachher:
import { getPreviewDetector } from '@/platform/services/cms/preview/preview-detector-registry';
export const PREVIEW_ROUTE_PREFIX = '/preview';
const previewDetector = getPreviewDetector();
if (previewDetector && !path.startsWith(PREVIEW_ROUTE_PREFIX) && previewDetector.isPreviewRequest(req.nextUrl)) {
  // rewrite analog zu heute, nur mit PREVIEW_ROUTE_PREFIX statt EDITOR_ROUTE_PREFIX
}
```

Hinweis: Middleware importiert **ausschließlich** `preview-detector-registry` (edge-safe Subgraph), **nicht** `preview-adapter-registry`. Das schließt das SDK aus dem Edge-Bundle aus. Die Drift-Datei `middleware-no-direct-storyblok-import.drift.test.ts` pinnt zusätzlich, dass kein direkter `@/platform/integrations/storyblok/**`-Import in `src/site/middleware.ts` landet.

Live-Edge-Runtime-Validierung ist gemäß [[feedback_test_real_edge_runtime]] Pflicht: Jest-Mock-Pass reicht **nicht**, der Production-Build-Smoke (`next build && next start` + Storyblok-Editor-iframe-Live-Test) ist Teil der Quality Gates.

## 7. Rückwärtskompatibilität

Diese Story lebt komplett im Branch `feature/SHOW-323`. Die `/editor/`-Route ist **in diesem Branch** entstanden und in keinem Production-Master gemerged. Konsequenz: keine Migration nötig, kein 301-Redirect, kein Co-existence-Pattern. Die alten Files werden im selben Commit gelöscht, der die neuen einführt.

Existierende Tests, die `/editor/` referenzieren, werden zu `/preview/` umgeschrieben (nicht neben den neuen Files duplizieren).

## 8. Test-Strategie (testing-engineer-Approved + Architect-Decisions)

### Pre-Impl-Commit-Slicing (4 Commits, real-failing)

**Commit 1 — Service-SPI + Factories**:
- `CmsPreviewAdapter.spi-shape.drift.test.ts` (failing — Interface-File existiert nicht)
- `preview-detector-registry.test.ts` (failing — Module-Not-Found, Dispatch storyblok/mock/none + Referenzgleichheit)
- `preview-adapter-registry.test.ts` (failing — Module-Not-Found, Dispatch storyblok/mock/none + Referenzgleichheit)

**Commit 2 — Storyblok-Preview-Adapter**:
- `storyblok-preview-detection.test.ts` (failing — Module-Not-Found auf `storyblok-preview-detection`; Test-Matrix aus heutigem `storyblok-editor-detection.test.ts` migriert)
- `StoryblokPreviewAdapter.render-preview-page.test.tsx` (failing — Module-Not-Found; Story-found mit valider Signatur, validation-failure → null, no-token → degraded, no-story → null)
- `MockPreviewAdapter.test.ts` (failing — Module-Not-Found; isPreviewRequest=false, renderPreviewPage=null)

**Commit 3 — App-Route**:
- `preview-route.test.tsx` (failing — `src/app/preview/...` existiert nicht; Adapter-Dispatch + Published-Fallback + notFound)
- `app-preview-no-storyblok-import.drift.test.ts` (failing — `walk()` findet kein File → `files.length > 0` assertion failt)

**Commit 4 — Middleware-Refactor**:
- `middleware-preview-rewrite.test.ts` (umgeschrieben aus `middleware-editor-rewrite.test.ts`; alle Assertions auf `/preview/`-Prefix failen, weil Middleware noch alten Pfad nutzt)
- `middleware-no-direct-storyblok-import.drift.test.ts` (failing — source-text audit findet `@/platform/integrations/storyblok/...`-Import in Middleware)

### Architect-Decisions (Antworten auf Engineer-Fragen)

| # | Frage | Entscheidung |
|---|---|---|
| F1 | `MockPreviewAdapter.renderPreviewPage` — null oder Mock-Page? | **null** — Caller-Page macht Published-Fallback. Mock-Preview im Production-Bundle hat keinen Use-Case. |
| F2 | SPI-File als `.d.ts` oder `.ts`? | **`.d.ts`** — konsistent zu `CmsAdapter.d.ts`. Drift-Test arbeitet mit `readFileSync`-Grep wie `CmsAdapter.spi-shape.drift.test.ts`. |
| F3 | Validation-Failure → null oder published-Render im Adapter? | **null im Adapter, Page macht published-Fallback** — saubere Trennung. Adapter rendert *nur* Preview oder nichts. |
| F4 | `PREVIEW_ROUTE_PREFIX` exportieren? | **Ja, `export const`** aus `src/site/middleware.ts`. Tests + Page-Komponenten können den Wert ohne magic strings pinnen. |
| F5 | Pre-Impl-Stil: `describe.skip` oder real-failing? | **Real-failing**. §8 sagt "failing-by-design" — Module-Not-Found / Assertion-Mismatch sind die Hypothesen. |

### Mocking-Strategien (Auszug, vollständig im Engineer-Strategy-Output)

- `preview-detector-registry.test.ts` / `preview-adapter-registry.test.ts`: Mock `CmsProviderResolver.resolveCmsProvider`, Sentinel-Mock der Adapter-Module. Identity-Assert (Referenzgleichheit) pinnt Singleton-Semantik.
- `storyblok-preview-detection.test.ts`: Pure-Function, keine Mocks. NextURL-Shape via `Object.create(null)`-Trick.
- `StoryblokPreviewAdapter.render-preview-page.test.tsx`: Mock `storyblok-preview-validation`, `get-storyblok-cms-api`, `StoryblokBridgeScript`, `storyblok-sdk-render`, `storyblok-token`. `beforeEach` re-seedet wegen globalem `afterEach(resetAllMocks)`.
- `preview-route.test.tsx`: Mock `preview-adapter-registry`, `get-cms-service`, `next/navigation`. Dynamic `require` der Page-Komponente.
- `middleware-preview-rewrite.test.ts`: Mock `preview-detector-registry` mit Default-Impl, die echte `isStoryblokPreviewRequest`-Function durchläuft (Edge-Cases am echten Code).
- `*-drift.test.ts`: `fs.readFileSync`-Audit. `walk()` muss `*.test.ts(x)` ausschließen, sonst findet er sich selbst.

### Browser-Smoke 4 Welten gegen `next build && next start` (HTTPS-Production-Build)

- **Welt A — Public ohne Token**: `https://localhost:3000/preview/main/de/home`. Beweis: HTTP 200, kein `data-blok-*`, kein Bridge-Script, kein Console-Error.
- **Welt B — Editor mit gültigem HMAC**: `https://localhost:3000/main/de/home?_storyblok_tk[...]=...` mit `HMAC-SHA-1(space:ts:token)`. Beweis: Middleware-Rewrite zu `/preview/...`, Bridge-Script im DOM, mindestens ein `data-blok-c`/`data-blok-uid`-Anker.
- **Welt C — Falsche space_id**: gleiche Shape, `space_id=999999`. Beweis: Rewrite läuft, Adapter returnt null (`reason: 'space-id-mismatch'`), published-Fallback rendert, kein Bridge.
- **Welt D — Veralteter Timestamp**: gleiche Shape, `timestamp=1`. Beweis: identisch zu C, `reason: 'expired'`.

**Cross-Welt-Beweise**:
- `git grep -nE 'EDITOR_ROUTE_PREFIX|/editor/' src/` liefert keine Treffer (AC-7).
- `grep -r "<STORYBLOK_ACCESS_TOKEN-Wert>" .next/static/` liefert keinen Treffer (AC-6).
- Build-Log: kein `@storyblok/*`-Modul in Middleware-Edge-Bundle (Webpack-Output / `--debug` falls nötig).

## 9. Implementations-Reihenfolge

1. ~~Plan-Hand-off an testing-engineer (Strategie-Modus).~~ DONE.
2. testing-engineer schreibt Pre-Impl-Test-Commits 1 + 2 + 3 + 4 (real-failing) auf `feature/SHOW-323`.
3. frontend-developer baut Production-Code → Tests grün. Inkludiert Cleanup im selben Commit:
   - `src/app/editor/**` weg
   - `src/platform/integrations/storyblok/cms/impl/storyblok-editor-detection.ts` weg (Inhalt nach `preview/storyblok-preview-detection.ts` migriert)
   - `editor-route.test.tsx` / `middleware-editor-rewrite.test.ts` / `storyblok-editor-detection.test.ts` weg (Inhalt jeweils migriert)
4. Cross-Review (architect + testing-engineer, sequenziell gespawned — Architect zuerst Architektur/Schichten, dann testing-engineer Test-Coverage + Browser-Smoke).
5. Browser-Smoke 4 Welten gegen `next build && next start`.
6. Quality Gates (10 Gates pflicht).
7. Push zu gitea + PR gegen `feature/SHOW-323-target`.

## 10. Akzeptanzkriterien

- [ ] AC-1: Datei `src/app/preview/[site]/[locale]/[[...slug]]/page.tsx` enthält keinen direkten `@storyblok/*`-Import (drift-test erzwungen).
- [ ] AC-2: Datei `src/site/middleware.ts` enthält keinen direkten Import aus `@/platform/integrations/storyblok/**` (drift-test erzwungen).
- [ ] AC-3: `getPreviewAdapter()` returnt für `provider=storyblok` ein `CmsPreviewAdapter`-Objekt mit `id === 'storyblok'`, für `provider=mock` eines mit `id === 'mock'`, für `provider=none` `null`.
- [ ] AC-4: Live-Edit aus Storyblok-Editor-iframe funktioniert auf `/preview/`-URL: Bridge-Script geladen, Story-Komponente gerendert, `_editable`-Anchors sichtbar.
- [ ] AC-5: Public-Zugriff (kein Token) auf `/preview/<slug>` rendert einen sicheren Fallback (no-token, no-bridge, kein Crash).
- [ ] AC-6: Production-Bundle enthält **keinen** Storyblok-Access-Token (grep im built-output verifiziert das).
- [ ] AC-7: Alte `/editor/`-Route + Editor-spezifische Tests sind vollständig aus dem Repo entfernt; `git grep -nE 'EDITOR_ROUTE_PREFIX|/editor/'` liefert in `src/` keine Treffer mehr.
- [ ] AC-8: `npm test` grün, `npm run build` grün, `npm run verify:client-chunks` grün, Browser-Smoke 4 Welten grün.

## 11. Quality Gates (gemäß [[feedback_quality_gates_per_slice]])

10 Gates pflicht. Production-Build-Smoke + Edge-Runtime-Validation gemäß [[feedback_test_real_edge_runtime]] explizit pflicht (nicht "Jest-Mock-Pass reicht").

## 12. Hard Rules für Sub-Agents (Re-Brief nach Crash-Vorfall)

Erkenntnisse aus dem Engineer-Crash der vorigen Session — in **jedem** Sub-Agent-Brief verankert:

1. **NIE `git stash` (auch nicht `-u`)** als Verifikations- oder Backup-Tool. Stash ist im worktree-bare-Repo-Setup nicht idempotent; `-u` captured worktree-Meta-Files (`HEAD`, `commondir`, `gitdir`, `index`).
2. **NIE worktree-Meta-Files anfassen** (`HEAD`, `commondir`, `gitdir`, `index`, `ORIG_HEAD`, `FETCH_HEAD` im worktree-Root). Diese sind Worktree-Setup-Files, kein Repo-Content.
3. **Sub-Agents IMMER im Background** ([[feedback_sub_agents_must_run_in_background]]). `run_in_background: true` ist Default.
4. **Keine Task-Internals im Code** ([[feedback_no_task_internals_in_code]]). Keine "Slice 8", "Variante B", "Preview-Route-Pivot", "SHOW-323", "PR #" in Code/Kommentar/Test-Title. Code beschreibt **was/warum technisch**, nicht den Story-Kontext.
5. **Cross-Review = 0 Findings** ([[feedback_cross_review_discipline]]). Keine "PASS mit Caveat" / "Approve with fix blockers" / "Follow-up im laufenden Slice".
6. **Branch-Workflow** ([[feedback_branch_and_pr_workflow]]). Arbeitsbranch: `feature/SHOW-323`. PR: head=`feature/SHOW-323`, base=`feature/SHOW-323-target`. NIE direkter PR gegen master. NIE push to origin (nur gitea).
7. **Live-Edge-Runtime-Tests** ([[feedback_test_real_edge_runtime]]). Production-Build-Smoke ist verbindlich. Jest-Mock-Pass ist NICHT der Approve-Beweis für Middleware-Changes.
8. **Stop-and-Ask** bei Plan-Lücken oder unerwarteten Konflikten. Nicht selbst "Pragmatik" einbauen. User konsultieren (über Architect).
