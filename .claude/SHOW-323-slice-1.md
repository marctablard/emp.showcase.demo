# Slice 1 — Adapter-Framework + Null/Local Adapter (AC #1)

> **Parent**: [`SHOW-323-plan.md`](./SHOW-323-plan.md)
> **Branch**: feature/SHOW-323 (Slice-1-Commits direkt darauf, oder Sub-Branch `feature/SHOW-323-slice-1`)
> **Status**: bereit zum Hand-off an testing-engineer

---

## 1. Goal

- App startet & rendert Home ohne `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` → **AC #1 erfüllt**.
- `CmsAdapter`-SPI + `DelegatingCmsService` + Provider-Resolver etabliert.
- `NullCmsAdapter` als Default für `NEXT_PUBLIC_CMS_PROVIDER=none` (oder Auto bei fehlendem Token).
- `LocalJsonCmsAdapter` (Logik aus `LocalCmsServiceSSR` portiert) → keine Regression für bestehende Local-CMS-Nutzer.
- Storyblok-Nutzer-Flow bit-identisch (Token vorhanden → bestehende Pages laufen direkt gegen SDK; das ändert sich erst in Slice 4).
- Alle bestehenden Tests grün, neue Tests grün.

## 2. Out-of-Scope (kommt in späteren Slices)

- StoryblokCmsAdapter / `cms-page.tsx` / Map-Renderer → Slice 4.
- Zod-Schemas / `HTMLAttributes`-Spread auf Default-Komponenten → Slice 2.
- Banner via API-Route → Slice 5.
- Per-Site-Theming → Slice 6.
- Löschen von `LocalCmsServiceSSR.ts` / `src/components/cms/local/` → Slice 2 (vorgezogen) (in Slice 1 bleibt der alte Code ohne `@injectable`-Decorator stehen, damit nichts bricht; der neue `LocalJsonCmsAdapter` übernimmt das DI-Binding).

---

## 3. Files

### Neu

| Datei | Layer | Zweck |
|---|---|---|
| `src/platform/services/cms/CmsAdapter.d.ts` | Service-SPI | Adapter-Interface |
| `src/platform/services/cms/CmsProviderResolver.ts` | Service-Helper | `(env) → 'storyblok' \| 'local' \| 'none'` |
| `src/platform/services/cms/CmsProviderResolver.test.ts` | Test | Env-Matrix |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.ts` | Service | Facade-Impl, `@injectable('CMSService')` |
| `src/platform/services/cms/impl/DelegatingCmsServiceSSR.test.ts` | Test | Delegation an Adapter (Mock) |
| `src/platform/services/cms/impl/NullCmsAdapter.ts` | Service (Null-Default) | `@injectable('CmsAdapter:none')` |
| `src/platform/services/cms/impl/NullCmsAdapter.test.ts` | Test | Methoden geben `CMSNoResult` |
| `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.ts` | Integration | `@injectable('CmsAdapter:local')`, Logik aus `LocalCmsServiceSSR` portiert |
| `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.test.ts` | Test | Page-Resolution + Default-Site-Fallback |
| `e2e/cms-no-token.spec.ts` | E2E | **AC #1** |

### Geändert

| Datei | Änderung |
|---|---|
| `src/platform/services/cms/CMSService.d.ts` | Interface erweitert (Vollvertrag, ready für Slice 4) |
| `src/platform/services/model/cms/cms-content.d.ts` | Stubs für `CMSBanner`, `CMSNavigation` ergänzen |
| `src/platform/services/cms/impl/LocalCmsServiceSSR.ts` | `@injectable`-Decorator entfernen; Logik wird obsolet (Bindings übernehmen die neuen Klassen). Datei bleibt in Slice 2 bereits. |
| `src/platform/services/cms/impl/LocalCMSServiceSSR.test.ts` (falls existent) | Tests werden 1:1 portiert in `LocalJsonCmsAdapter.test.ts`; alte Datei löschen oder skippen |
| `src/platform/depency.yml` | `CMSService: DelegatingCmsServiceSSR` |
| `src/instrumentation.ts` | Post-Bootstrap-Hook: `container.bind('CmsAdapter').toService(...)` |
| `src/lib/storyblok.ts` | Lazy/Conditional `storyblokInit` (Token-Guard) |
| `src/providers/StoryblokProvider.tsx` | Conditional Render (no-op ohne Token) |
| `src/components/cms/storyblok/storyblok-cms-page.tsx` | Graceful `null`-Handling aus `getStoryblokApi()` |
| `src/hooks/banner/use-banner.ts` | Graceful `null`-Handling (interim — wird in Slice 5 ersetzt) |
| `src/platform/healthcheck/env-validation.ts` | Storyblok-Token → `OPTIONAL_ENV_VARS` (severity `warning`) |
| `src/platform/healthcheck/__tests__/env-validation.test.ts` | Erweitert: Token-Absenz → kein `hasErrors` |
| `src/lib/common/public-default-env.ts` | `NEXT_PUBLIC_CMS_PROVIDER` Default `""` |
| `next.config.ts` | `NEXT_PUBLIC_CMS_PROVIDER` durchreichen |
| `.env.template` | `NEXT_PUBLIC_CMS_PROVIDER` dokumentieren |

### Gelöscht

Nichts. (`LocalCmsServiceSSR.ts`-Klasse bleibt als toter Code in Slice 2 bereits.)

---

## 4. Interface-Definitionen (final für Slice 1)

```typescript
// src/platform/services/model/cms/cms-content.d.ts (Stubs hinzufügen)
export interface CMSBanner {
  title: string;
  link?: { url: string; target?: string };
  is_active: boolean;
}

export interface CMSNavigation {
  items: Array<{ title: string; href: string }>;
}

// CMSPage, CMSComponent, CMSNoResult bleiben wie heute
```

```typescript
// src/platform/services/cms/CMSService.d.ts (erweitert)
import type { ComponentType, HTMLAttributes } from 'react';
import type {
  CMSBanner,
  CMSComponent,
  CMSNavigation,
  CMSNoResult,
  CMSPage,
} from '../model/cms';

export interface CMSService {
  readonly providerId: string;
  hasContent(): boolean;
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getBanner(locale: string, site: string): Promise<CMSBanner | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  getEditableProps(component: CMSComponent): HTMLAttributes<HTMLElement>;
  readonly BridgeScript: ComponentType | null;
}
```

```typescript
// src/platform/services/cms/CmsAdapter.d.ts (neu)
import type { ComponentType, HTMLAttributes } from 'react';
import type {
  CMSBanner,
  CMSComponent,
  CMSNavigation,
  CMSNoResult,
  CMSPage,
} from '../model/cms';

export interface CmsAdapter {
  readonly id: string;
  hasContent(): boolean;
  getPage(slug: string, locale: string, site: string): Promise<CMSPage | CMSNoResult>;
  getBanner(locale: string, site: string): Promise<CMSBanner | CMSNoResult>;
  getNavigation(locale: string, site: string): Promise<CMSNavigation | CMSNoResult>;
  /** Optional. Reine DOM-Attribute, KEIN Wrapper-Tag. */
  getEditableProps?(component: CMSComponent): HTMLAttributes<HTMLElement>;
  /** Optional. Einmalig im Layout gemountet. */
  BridgeScript?: ComponentType;
}
```

---

## 5. Implementierungs-Verträge

### 5.1 `CmsProviderResolver`

```typescript
// src/platform/services/cms/CmsProviderResolver.ts
export type CmsProviderId = 'storyblok' | 'local' | 'none';

export function resolveCmsProvider(env: NodeJS.ProcessEnv = process.env): CmsProviderId {
  const explicit = env.NEXT_PUBLIC_CMS_PROVIDER?.trim();
  if (explicit === 'storyblok' || explicit === 'local' || explicit === 'none') {
    return explicit;
  }
  if (env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim()) return 'storyblok';
  return 'none';
}
```

**Test-Matrix** (Pflicht):
| `NEXT_PUBLIC_CMS_PROVIDER` | `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` | Erwartet |
|---|---|---|
| (unset) | (unset) | `'none'` |
| (unset) | `'abc'` | `'storyblok'` |
| `'storyblok'` | (unset) | `'storyblok'` |
| `'local'` | (unset) | `'local'` |
| `'none'` | `'abc'` | `'none'` (explicit overrides auto) |
| `'invalid'` | (unset) | `'none'` |
| `'  '` (whitespace) | (unset) | `'none'` |
| `'  storyblok  '` | (unset) | `'storyblok'` (trimmed) |

### 5.2 `DelegatingCmsServiceSSR`

```typescript
// src/platform/services/cms/impl/DelegatingCmsServiceSSR.ts
import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { CmsAdapter } from '../CmsAdapter';
import type { CMSService } from '../CMSService';
// … model imports

@injectable('CMSService', 'Singleton')
export class DelegatingCmsServiceSSR implements CMSService {
  constructor(@inject('CmsAdapter') private readonly adapter: CmsAdapter) {}

  get providerId(): string { return this.adapter.id; }
  hasContent(): boolean { return this.adapter.hasContent(); }
  getPage(slug: string, locale: string, site: string) {
    return this.adapter.getPage(slug, locale, site);
  }
  getBanner(locale: string, site: string) {
    return this.adapter.getBanner(locale, site);
  }
  getNavigation(locale: string, site: string) {
    return this.adapter.getNavigation(locale, site);
  }
  getEditableProps(c: CMSComponent): HTMLAttributes<HTMLElement> {
    return this.adapter.getEditableProps?.(c) ?? {};
  }
  get BridgeScript(): ComponentType | null {
    return this.adapter.BridgeScript ?? null;
  }
}

export default DelegatingCmsServiceSSR;
```

### 5.3 `NullCmsAdapter`

```typescript
// src/platform/services/cms/impl/NullCmsAdapter.ts
import { injectable } from '@/platform/core/di/injectable';
import type { CmsAdapter } from '../CmsAdapter';
// … model imports

@injectable('CmsAdapter:none', 'Singleton')
export class NullCmsAdapter implements CmsAdapter {
  readonly id = 'none';

  hasContent(): boolean { return false; }

  async getPage(slug: string): Promise<CMSNoResult> {
    return { notfound: true, message: `No CMS provider configured (slug: ${slug})` };
  }
  async getBanner(): Promise<CMSNoResult> { return { notfound: true }; }
  async getNavigation(): Promise<CMSNoResult> { return { notfound: true }; }
  // getEditableProps & BridgeScript bewusst NICHT implementiert (Optional)
}

export default NullCmsAdapter;
```

### 5.4 `LocalJsonCmsAdapter`

Logik 1:1 aus `LocalCmsServiceSSR.ts` portieren. Änderungen:
- Klassenname: `LocalJsonCmsAdapter`
- Decorator: `@injectable('CmsAdapter:local', 'Singleton')`
- Implementiert `CmsAdapter` (statt `CMSService`)
- `id = 'local'`
- `hasContent()`: returnt `true`
- `getPage(...)`: bestehende Logik
- `getBanner()`, `getNavigation()`: Stubs `return { notfound: true }` (in späterer Slice ausgebaut)

**Wichtig**: `defaultSite`-Parameter heute hardcoded `'_default_'`. Neu via `process.env.NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE` mit Fallback. (Slice 1: ENV einlesen; in `public-default-env.ts` Default setzen.)

### 5.5 Storyblok Lazy-Init

```typescript
// src/lib/storyblok.ts
import { apiPlugin, storyblokInit } from '@storyblok/react/rsc';
// … component imports

const TOKEN = process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim();

const noopApi = (() => null) as ReturnType<typeof storyblokInit>;

export const getStoryblokApi = TOKEN
  ? storyblokInit({
      accessToken: TOKEN,
      use: [apiPlugin],
      bridge: true,
      apiOptions: { maxRetries: 2, cache: { type: 'none' } },
      components: { /* unverändert */ },
    })
  : noopApi;
```

Caller-Anpassungen (graceful null):
- `storyblok-cms-page.tsx::fetchData`: try/catch existiert schon, prüft heute `.data?.story`. Reicht — kein Crash, gibt `null` zurück, Page rendert `notFound()` oder empty.
- `use-banner.ts::fetchBannerData`: vor SDK-Call prüfen `if (!api) { setData(null); setIsLoading(false); return; }`.
- `StoryblokProvider.tsx`: 
  ```tsx
  if (!process.env.NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN?.trim()) return children;
  getStoryblokApi();
  return children;
  ```

### 5.6 DI-Aliasing in `instrumentation.ts`

```typescript
// src/instrumentation.ts (Ausschnitt — exakte Stelle in Pre-Implementation final)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { container: serverContainer } = await import('@/platform/server');
    const { container: ssrContainer } = await import('@/platform/ssr');
    const { resolveCmsProvider } = await import('@/platform/services/cms/CmsProviderResolver');

    const providerId = resolveCmsProvider(process.env);
    for (const c of [serverContainer, ssrContainer]) {
      c.bind('CmsAdapter').toService(`CmsAdapter:${providerId}`);
    }
  }
}
```

**Anmerkung**: Exakte Container-Boot-Sequence (incl. ob `register()` so heute existiert oder ob via `getServer()`-Lazy-Init gebootet wird) klärt `frontend-developer` während Pre-Implementation gegen `src/instrumentation.ts` und `scripts/di-generator.ts`. Fallback-Option: Aliasing in einer eigenen `cms-binding.ts`, die als Side-Effect-Import aus den Container-Files getriggert wird.

---

## 6. ENV-Verträge

| Variable | Slice-1-Default | Verhalten |
|---|---|---|
| `NEXT_PUBLIC_CMS_PROVIDER` | `""` | Leer → Auto-Resolution via Token-Check |
| `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` | `""` | jetzt **optional** (OPTIONAL_ENV_VARS, severity `warning`) |
| `NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE` | `"_default_"` | bisher hardcoded |
| `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` | `"false"` | unverändert |
| `NEXT_PUBLIC_STORYBLOK_ACCESS_PREVIEW` | `"true"` | unverändert |

`.env.template` bekommt neuen Block:

```
# === CMS Provider ===
# Optional. Werte: storyblok | local | none.
# Leer = auto: Storyblok-Token vorhanden → storyblok, sonst none.
NEXT_PUBLIC_CMS_PROVIDER=
# Default-Site für Local-CMS-Fallback (data/cms/<site>/<lang>/<slug>.json).
NEXT_PUBLIC_CMS_LOCAL_DEFAULT_SITE=_default_
```

---

## 7. Tests (Verträge — Detail-Implementation durch testing-engineer)

### Unit / Jest

| Datei | Wesentliche Assertions |
|---|---|
| `CmsProviderResolver.test.ts` | Alle 8 Env-Matrix-Zellen aus §5.1 |
| `NullCmsAdapter.test.ts` | `id === 'none'`; `hasContent() === false`; alle drei `get*`-Methoden geben `{ notfound: true }`; `getEditableProps` und `BridgeScript` nicht implementiert (`undefined`) |
| `DelegatingCmsServiceSSR.test.ts` | Mit Mock-Adapter: alle Methoden delegieren mit korrekten Argumenten; `providerId` reflektiert `adapter.id`; `getEditableProps`-Fallback `{}` bei `undefined`; `BridgeScript`-Fallback `null` bei `undefined` |
| `LocalJsonCmsAdapter.test.ts` | Portiert aus `LocalCmsServiceSSR.test.ts` (falls existent); plus: `id === 'local'`, `hasContent() === true`, `getBanner/getNavigation` → `notfound` |
| `env-validation.test.ts` (erweitert) | Storyblok-Token fehlt → `hasWarnings === true`, `hasErrors === false`; Token vorhanden → keine Warnung |

### E2E / Playwright

| Datei | Szenario |
|---|---|
| `e2e/cms-no-token.spec.ts` | Setup: `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN=""` (via Test-spezifische Env). Navigiert auf `/`. Assertion: Status 200, kein "access token"-Console-Error, Page-Skelett (Header/Footer) ist da, Main-Content darf empty sein. |

### Regressions-Sicherheit (bestehende Suite)

- Bestehende Storyblok-E2E (falls existent) müssen mit gesetztem Token weiter grün sein.
- `npm run verify:client-chunks` ohne neue `@storyblok/*`-Bundles (bleibt unverändert in Slice 1).
- Lint + TS-strict grün.

---

## 8. Akzeptanzkriterien Slice 1

- [ ] `npm run build` ohne `NEXT_PUBLIC_STORYBLOK_ACCESS_TOKEN` → exit 0.
- [ ] `npm start` ohne Token → Home liefert 200, kein Module-Load-Crash, kein `storyblok-access-token`-Console-Error.
- [ ] `CmsService = DelegatingCmsServiceSSR` resolved gegen NullAdapter (wenn keine Konfiguration) bzw. LocalJsonAdapter (wenn `CMS_PROVIDER=local`).
- [ ] Bestehende Storyblok-Deployments (Token gesetzt) verhalten sich bit-identisch.
- [ ] Bestehende Local-CMS-Demos (mit `NEXT_PUBLIC_CMS_PROVIDER=local` gesetzt) liefern Content via `LocalJsonCmsAdapter` weiter.
- [ ] Alle neuen Unit-Tests grün, alle bestehenden Tests grün.
- [ ] Lint, TS-strict, `verify:client-chunks` grün.

---

## 9. Risiken & Mitigation

| Risiko | Mitigation |
|---|---|
| `getStoryblokApi()` wird an Stelle aufgerufen, die ich nicht entdeckt habe (Crash bei `null`) | grep über `@/lib/storyblok` und `getStoryblokApi` vor Implementation; jede Call-Site auditieren |
| Container-Bootstrap-Reihenfolge: Aliasing in `instrumentation.ts` läuft zu spät | Fallback via Side-Effect-Module in `server.ts`/`ssr.ts`; in Pre-Implementation prüfen |
| Bestehende `LocalCmsServiceSSR.test.ts` referenziert obsolete API | Tests werden mit migriert in `LocalJsonCmsAdapter.test.ts`; bestehende Datei nach Migration löschen |
| `hasErrors`-Schwelle im Healthcheck triggert noch durch alte Asserts | `env-validation.test.ts` mit erweitern |

---

## 10. Hand-off-Ablauf

1. **`testing-engineer` Strategie-Modus**
   - Verfeinerung der Test-Files (Datei-Liste oben), Adapter-Contract-Suite-Skelett (auch wenn nur 2 Adapter in Slice 1 angeschlossen sind).
   - Output: konkrete Test-Skelette als Files-Liste.
2. **`testing-engineer` Pre-Implementation**
   - Committed failing Tests:
     - `e2e/cms-no-token.spec.ts` (rot, weil Storyblok heute crasht).
     - `CmsProviderResolver.test.ts` (rot, Datei existiert nicht).
     - `DelegatingCmsServiceSSR.test.ts`, `NullCmsAdapter.test.ts`, `LocalJsonCmsAdapter.test.ts` (rot).
     - `env-validation.test.ts` erweitert (rot).
3. **`frontend-developer` Build**
   - Implementiert nach diesem Plan, gegen die failing Tests.
   - Pre-Implementation-Check: Container-Init-Sequenz, Caller-Sites von `getStoryblokApi`.
4. **Cross-Review**
   - `architect` (Schichten, DI, ENV).
   - `testing-engineer` (Tests komplett, AC nachweisbar).
5. **Merge** → Slice 1 done. Slice-2-Planung startet.

---

## Anmerkungen für Folge-Slices

- Nach Slice 1: `LocalCmsServiceSSR.ts` ist Dead Code (kein `@injectable`-Decorator, kein Import). Slice 2 löscht die Datei.
- Nach Slice 1: `src/lib/storyblok.ts` hat Token-Guard, ist aber sonst unverändert. Slice 4 löscht die Datei und migriert in `StoryblokCmsApi`.
- `CMSBanner` / `CMSNavigation` sind in Slice 1 nur Stubs. Slice 2 ersetzt sie durch Zod-Schemas, Slice 5 verkabelt Banner-Hook über API-Route.

---

## 11. Addendum nach Test-Strategie-Review (testing-engineer Strategie-Modus)

### A. `CmsDataLoader`-Strategy für `LocalJsonCmsAdapter`

Der Adapter bekommt einen optionalen Konstruktor-Parameter `loader: CmsDataLoader`, default = Production-Loader mit webpack-context-`import()`. Tests injecten Fake-Loader.

```typescript
// in LocalJsonCmsAdapter.ts
export type CmsDataLoader = (
  site: string,
  locale: string,
  slug: string,
) => Promise<unknown | null>;

const defaultJsonLoader: CmsDataLoader = (site, locale, slug) =>
  import(`../../../../../../data/cms/${site}/${locale}/${slug}.json`)
    .then((m) => m.default)
    .catch(() => null);

@injectable('CmsAdapter:local', 'Singleton')
export class LocalJsonCmsAdapter implements CmsAdapter {
  readonly id = 'local';
  constructor(
    @inject('SessionService') private session: SessionService,
    @inject('LoggerService')  private logger: LoggerService,
    private readonly loader: CmsDataLoader = defaultJsonLoader,
  ) {}
  // … getPage benutzt this.loader(site, locale, slug) statt direktem import
}
```

**Begründung**: Webpack/Next baut Templates wie `import(\`../data/cms/${...}.json\`)` zur Build-Zeit zu einem Context-Module. Ein String-`dataRoot` zur Laufzeit kann das nicht ändern. Die Strategy-Injection ist die saubere DI-Variante, bleibt für Production transparent (Default-Loader macht weiter den heutigen Pfad-Import) und macht Tests fixture-frei und sauber.

### B. Zusätzlicher Test in Slice 1

Files-Liste in §3 wird ergänzt um:

| Datei | Layer | Zweck |
|---|---|---|
| `src/hooks/banner/use-banner.test.tsx` | UI/Test | Token-Guard: bei `getStoryblokApi() === null` → `data=null`, `isLoading=false`, kein API-Call |

Pflicht-Assertions:
- Mock `@/lib/storyblok` mit `getStoryblokApi = (() => null)` → Hook setzt `data: null`, `isLoading: false`, ruft keinen fetch.
- Mock `@/lib/storyblok` mit echter Fake-API-Funktion → Hook ruft `api.get('cdn/stories/top-banner-announcement', …)`.

Framework: Jest React-Project (jsdom). React-Testing-Library für Hook-Render.

### C. Adapter-Contract-Test-Setup

Übernommen wie vom testing-engineer vorgeschlagen:
- `src/platform/services/cms/__tests__/CmsAdapter.contract.ts` — Helper-Datei (NICHT mit `.test.ts`-Endung, damit Jest sie nicht direkt picked).
- `src/platform/services/cms/impl/NullCmsAdapter.contract.test.ts` — Runner für NullAdapter.
- `src/platform/integrations/local/cms/impl/LocalJsonCmsAdapter.contract.test.ts` — Runner für LocalJsonAdapter (mit Fake-`CmsDataLoader`).

Contract erzwingt: nie throws, valide Shapes, optional-Surface vertragsgerecht (`HTMLAttributes` bzw. renderbares ComponentType).

### D. Klarstellung zur Storyblok-E2E

Kein dedizierter Storyblok-E2E-Test im Repo. AC „Storyblok-Flow bleibt funktional" wird durch bestehende `e2e/homepage.spec.ts` (mit gesetztem Token im Standard-Setup) und durch den manuellen Visual-Editor-Smoke-Test in Slice 4 abgesichert. In Slice 1 keine zusätzliche E2E-Pflicht hierfür.

### E. E2E-Mechanik für `cms-no-token.spec.ts`

Bestätigt: `test.skip(!process.env.E2E_CMS_NO_TOKEN, '…')` Pattern wie in `auth-site-sync.spec.ts`. Tester startet `next start` mit leerem Token und `E2E_CMS_NO_TOKEN=true`, dann läuft die Suite. Kein `playwright.config.ts` neu — das ist Infra-Erweiterung für spätere Stories.

### F. Hand-off-Disziplin

Pre-Implementation-Schritt führt vor Test-Commits einen Audit-Grep aus:
```
rg -n "getStoryblokApi|@/lib/storyblok" src/
```
Ergebnisse werden als Audit-Liste in den Test-Commit-Body übernommen, damit der frontend-developer weiß, welche Call-Sites er gracefull behandeln muss.

---

## 12. Post-CR-Cleanup (PR #1) — Stand 2026-05-15

PR #1 hatte 20 Review-Kommentare. Cleanup ist in 6 Commits (`cedf7de..081f522`) umgesetzt und gepusht.

### 12.1 Was sich gegenüber §4 / §5.3 / §5.4 / §11 geändert hat

| Aspekt | Vorheriger Plan | Tatsächlicher Zustand nach Cleanup |
|---|---|---|
| `CMSService.getBanner` | im Interface | **entfernt** |
| `CmsAdapter.getBanner` | optional im SPI | **entfernt** |
| `CMSBanner` Domain-Type | als Stub in `cms-content.d.ts` | **gelöscht** |
| `CMSNavigation` | als Stub in `cms-content.d.ts` | **moved** nach `model/cms/navigation.d.ts` |
| Provider-IDs | Literal-Strings im Resolver | **zentral** in `CMS_PROVIDER_IDS as const` + `CmsProviderId` Type |
| `LocalCmsServiceSSR.providerId` | `'local-legacy'` | `'local'` (Type-Tightening) — Klasse weiter Dead Code, Löschung jetzt in Slice 2 |
| Code-Kommentare | mit `SHOW-323`/`Slice N`/`.claude/`-Verweisen | **clean** — Code-Kommentare beschreiben nur Funktion/Constraint |

### 12.2 Test-Coverage-Diff

| Datei | Δ |
|---|---|
| `CmsAdapter.contract.ts` | −1 (getBanner-Vertrag) |
| `NullCmsAdapter.test.ts` | −1 (getBanner-Stub-Test) |
| `DelegatingCmsServiceSSR.test.ts` | −1 (getBanner-Delegation-Test) |
| `LocalJsonCmsAdapter.test.ts` | −1 (getBanner-Stub-Test) |
| `CmsProviderResolver.test.ts` | **+1** (Drift-Guard: jeder ID-Wert wird akzeptiert) |
| **Netto** | **−3** |

Final: 79 Suites / 743 Tests grün.

### 12.3 Carry-Forward zu Slice 2

- `LocalCMSServiceSSR.ts` löschen (M2 aus Cross-Review).
- `src/components/cms/local/local-cms-page.tsx` löschen — Routing-Verweise auflösen.
- `BannerSchema` + Banner-Komponente in der Component-Map mit registrieren (Schritt Richtung Slice 5).
