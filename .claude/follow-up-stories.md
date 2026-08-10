# Folge-Stories nach SHOW-323

Tracking von Architektur-Anliegen, die **nach** Abschluss von SHOW-323 (alle 7 Slices) als eigene Stories in eigenen Branches angegangen werden. Sie sind **bewusst nicht** Teil von SHOW-323, weil sie repo-weite Convention-Etablierungen sind, die getrennten Scope und getrennte CR-Reviewer verlangen.

---

## FU-001 — `data-testid`-Helper-Convention repo-weit

### Context

PR #2 zur Slice-2-Migration hat einen `data-testid={`hero-video-toggle-${slot}`}`-Template-Literal-Ausdruck in `src/components/cms/hero/hero-video-toggle.tsx` eingeführt. Michael Hammer hat im CR (Comment #42 am 2026-05-18) vorgeschlagen, das in einen Helper `createTestId('hero-video-toggle', slot)` auszulagern.

### Befund

| Metrik | Wert |
|---|---|
| `data-testid`-Vorkommen in Production-Code | 120 in 35 Files |
| Davon in SHOW-323 berührt | **1** (`hero-video-toggle.tsx`) |
| Im Rest des Repos unangetastet | **119 in 34 Files** |
| Bestehender `createTestId`-Helper | nein |
| Bestehendes ähnliches Pattern | `checkout-validation-registry.tsx` Zeile 198/216 hat `testIdPrefix`-Konzept für Forms — aber form-spezifisch |

Patterns, die im Repo koexistieren (Inkonsistenz):
- `<feature>-<sub>` statisch (`product-price`, `approval-submitButton`)
- Mit Template-Literal (`data-testid={`payment-method-${option.code}`}`)
- Mixed camelCase / kebab-case (`passwordReset-email` vs. `product-addToCartButton`)
- Dynamisch verschachtelt (`approval-approver-${approver.userId}`)

### Vorschlag-Diskussion (aus PR-Comment)

Michael-Vorschlag:
```tsx
<div
  className={slot === 'mobile' ? mobileClass : desktopClass}
  onClick={handleClick}
  {...createTestId('hero-video-toggle', slot)}
>...</div>
```

### Outcome

**Nicht in SHOW-323 angefasst.** Begründung:
- 1 isolierte Stelle einzuführen wäre stilfremd zu den 119 anderen → erzeugt Inkonsistenz
- Repo-weite Convention-Entscheidung gehört in eigene Story
- Verschiedene CR-Reviewer (Pre-Sales-CMS-Adapter ≠ Repo-weite Test-Infrastructure)

### Was die neue Story leisten muss

1. **Helper-Design** klären:
   - Free-string vs. Type-constrained (Union-Type für gültige Prefixes)?
   - Inputs: `createTestId(prefix, ...parts)` → `{ 'data-testid': 'prefix-part1-part2' }`?
   - Konstanten-Sammlung pro Feature (z. B. `TEST_IDS.hero.videoToggle('mobile')`)?
2. **Naming-Convention** klären: kebab-case durchgängig? camelCase wie heute oft?
3. **Migration aller 120 Stellen** in einem oder mehreren PRs (vermutlich Cluster-weise: Account, Cart, Checkout, Forms, Header, Login, Password-Reset, Product, Register, Search)
4. **Tests** für den Helper
5. **Optional**: Migration auf `data-test` oder anderes Attribut-Naming (falls Cypress-/Playwright-Strategie-Wechsel geplant)
6. **Doku** in `docs/testing-guide.md` (?) verankern

### Voraussetzung zum Start

SHOW-323 abgeschlossen (alle 7 Slices), gemergt zu master.

### Kontext-Quellen

- PR #2 Comment #42 (Gitea, am `feature/SHOW-323`)
- Audit-Daten in `.claude/SHOW-323-plan.md` (kein expliziter Cross-Verweis nötig)

---

## FU-002 — E2E-Coverage für CMS-Komponenten via fixture-Page

### Origin

testing-engineer Iteration-2 Cross-Review (Slice 3), 2026-05-18.

### Context

Slice 3 hat **14 neue CMS-Komponenten + 7 Pattern-A-Inseln + 4 Container** migriert, ohne neue Playwright-Specs hinzuzufügen. Die bestehende E2E-Suite (`/e2e/`) deckt nur Slice 1 (`cms-no-token.spec.ts`) und Slice 2 (`homepage.spec.ts`) ab. Die 19 registrierten Komponenten haben ihre Unit-Tests (Jest + RTL mit gemockten Hooks), aber keine End-to-End-Verifikation auf einem real gemounteten, hydrierten Seiten-Tree.

### Befund

| Metrik | Wert |
|---|---|
| Registrierte CMS-Komponenten | 19 |
| Davon mit E2E-Coverage | 0 (nur Hero indirekt über `homepage.spec.ts`) |
| Pattern-A-Inseln | 7 (Hero-Video, Media-Text-Player, Recommendations, …) |
| Container | 4 (page, columns, grid, segment) |
| Bestehende E2E-Specs | `cms-no-token.spec.ts`, `homepage.spec.ts` |

### Risk

Slice 4 (`StoryblokAdapter`-Migration) bündelt den Render-Pfad hinter dem `CmsAdapter`-SPI. Ohne E2E-Schutz für die 19 Komponenten ist eine Slice-4-Drift bei einer einzelnen Komponente (z. B. ein Hydration-Mismatch in einer Insel, eine kaputte Spread-Surface, ein fehlender Storyblok-Editable-Marker) erst manuell auffindbar — vermutlich erst nach Visual-Inspection in der Preview. Die Unit-Suite würde nichts melden, weil sie die Adapter-Schicht mockt.

### Recommendation

**Eine Playwright-Spec für eine Fixture-Page über `LocalJsonCmsAdapter`**, die alle 19 registrierten Komponenten in einer Seite rendert.

Akzeptanzkriterien:
1. Alle 19 Komponenten haben sichtbare DOM-Marker (`data-testid="cms-<name>"`) und werden über die Spec einzeln verifiziert.
2. Pattern-A-Inseln hydratisieren und reagieren auf User-Interaktion (Hero-Video-Toggle klickbar, Media-Text-Player startet, Recommendations-Carousel scrollbar, …).
3. Keine console-errors / console-warnings beim Mount der Page.
4. Storyblok-Editable-Attribute (`data-blok-*`) sind auf den Wrappern vorhanden, wo sie übergeben werden (Bridge-Hydration-Check).

### Setup-Requirements

- **Test-Fixture-Page**: `src/data/cms/<test-site>/<test-locale>/_all-cms.json` mit einer Page, deren `body[]` jede der 19 registrierten Komponenten genau einmal enthält.
- **Test-Site-Konfiguration**: Eintrag in der Site-Map (`sites.json` oder Äquivalent), damit `LocalJsonCmsAdapter` die Fixture-Site auflöst.
- **CI-Konfiguration**: Sicherstellen, dass der `LocalJsonCmsAdapter` per ENV im E2E-Run aktiv ist (oder via Adapter-Override in der Spec-Setup).
- **Optional**: Helper `expectAllCmsComponentsVisible(page)` für andere zukünftige E2E-Specs.

### Priority

**Hoch** — Eingangsvoraussetzung für Slice 4 (StoryblokAdapter). Ohne diesen Schutz ist die Adapter-Migration ein blindes Refactoring.

### Scope-Estimate

1–2 Tage Arbeit (Mini-Slice):
- Fixture-JSON aufbauen: ~3h
- Site-/Adapter-Wiring: ~2h
- Playwright-Spec: ~4h
- CI-Anpassung + Stabilisierung: ~3h

### Voraussetzung zum Start

SHOW-323 Slice 3 abgeschlossen und gemergt. Optional: parallel zu Slice 4 als Vorlauf-PR.

### Kontext-Quellen

- testing-engineer Iteration-2 Cross-Review (Slice 3)
- `.claude/SHOW-323-plan.md` §17.5 Decisions 19, 21
- Bestehende E2E-Specs in `/e2e/`

---

## FU-003 — Tailwind v4 Utility-Layer-Order vs. `button` / `a` Browser-Defaults

### Origin

Architect-Browser-Smoke während Slice-6-Verifikation (Per-Site-Theming, 2026-05-20).

### Context

User-Skepsis zur Per-Site-Theming-Implementation hat einen Live-Browser-Test ausgelöst: `getComputedStyle()` auf konkreten DOM-Elementen mit Klasse `bg-surface-action` über zwei Sites. Verifikation des Theming-Patterns selbst war positiv (DIV-Elemente zeigen pro Site verschiedene Override-Werte), aber dabei wurde ein vorbestehendes Tailwind-Layer-Issue sichtbar.

### Befund

| Element | Klasse | Computed `background-color` (Site `main`) |
|---|---|---|
| `DIV` | `bg-surface-action` | `lab(88.4647 -43.269 20.2787)` ✓ (Override greift) |
| `BUTTON` | `bg-surface-action` | `rgba(0, 0, 0, 0)` ✗ (transparent, Browser-Default) |
| `A` | `bg-surface-action` | `rgba(0, 0, 0, 0)` ✗ (transparent, Browser-Default) |

Tailwind v4 generiert für die Utility:

```css
.bg-surface-action { background-color: var(--color-surface-action); }
```

Bei `<button>` und `<a>` greift sie aber nicht. Vermutete Ursache: Tailwind v4 `@layer base` enthält Default-Resets (z. B. `button { background-color: transparent; }`) mit höherer Cascade-Position als `@layer utilities` — oder Spezifitäts-Konflikt durch User-Agent-Stylesheets, die `@layer utilities` nicht überschreiben kann.

### Wichtig: nicht ein Theming-Bug

Das Problem würde auch **ohne** Per-Site-Theming auftreten. Pre-existing in der Tailwind-v4-Setup-Konfiguration. Slice-6-Browser-Smoke hat es nur sichtbar gemacht.

### Was die Story leisten muss

1. **Root-Cause-Analysis**: warum greift `bg-surface-action` auf `<button>`/`<a>` nicht?
   - Ist es `@layer base` Order in Tailwind v4?
   - User-Agent-Stylesheet-Spezifität?
   - Konkurrierende `@apply` in `@layer base`?
2. **Fix**: passende Layer-Verschiebung, `!important` als Stop-Gap, oder zusätzliche Spezifität in der Utility (`button.bg-surface-action`).
3. **Tests**:
   - RTL- oder E2E-Tests, die für `<button>`-Elemente mit `bg-*`-Klassen den Computed-Style-Background pinnen
   - Cross-Site-Theming-Test, der das Verhalten auf Buttons UND Divs verifiziert
4. **Audit**: alle `<button>`/`<a>` im Repo mit `bg-*`-Klassen identifizieren — wieviele waren bisher latent kaputt?
5. **Doku**: `docs/styling-and-theming.md` Hinweis "Tailwind-Utilities auf `<button>`/`<a>` brauchen X" oder dieser Helper.

### Scope-Estimate

1 Tag Arbeit:
- Root-Cause-Analysis: 2–3h
- Fix + Tests: 3–4h
- Audit-Sweep über bestehende Components: 1–2h
- Doku: 1h

### Voraussetzung zum Start

SHOW-323 abgeschlossen.

### Kontext-Quellen

- Architect-Browser-Smoke 2026-05-20, Computed-Styles via `playwright-cli eval`
- `src/app/globals.css` `@theme inline` / `@theme` / `@layer base` Definitionen
- Bundled CSS-Output unter `.next/static/chunks/*.css` (Tailwind-Layer-Order verifizierbar)

---

## FU-004 — Banner-Hook über das CMS-Framework migrieren (`use-banner` retire)

### Origin

SHOW-323 Slice 4 Carry-Forward, dokumentiert in `.claude/agent-memory/frontend-developer/feedback_show323_slice4_banner_lib_storyblok_carryforward.md` und im Code-Kommentar von `src/hooks/banner/storyblok-banner-api.ts`. Beim EMP-23 Final-Cleanup-Audit (2026-05-31) bestätigt als einzige verbleibende AC-#2.b-Abweichung.

### Context

`src/hooks/banner/use-banner.ts` ist ein Browser-Hook, der den Top-Banner per direktem Storyblok-Content-Delivery-Call zieht. Sein Helper `storyblok-banner-api.ts` initialisiert `storyblokInit({ accessToken, use: [apiPlugin], bridge: true })` clientseitig (Token-Guard: ohne Token wird ein No-Op-Accessor exportiert, kein Modul-Load-Crash mehr — das war der Slice-1-Hotfix).

Stand der Pipeline:
- Die Banner-Komponente `top-banner-announcement` ist seit Phase B'/C als Co-Location-Default-Komponente im `cmsComponentMap`.
- Die Layout-Pipeline (`getLayout` / `ContentSlot`) aus Phase D ist verfügbar.
- Ein Webhook-Endpoint inkl. HMAC + `revalidateTag`-Pfaden existiert (Phase E).
- Aber: der Hook + sein Storyblok-Direct-Accessor sind NICHT durch den Provider-agnostischen `CMSService` ersetzt worden.

### Befund

| Metrik | Wert |
|---|---|
| Production-Files mit `@storyblok/*`-Import außerhalb von `src/platform/integrations/storyblok/*` | **2** (`use-banner.ts`, `storyblok-banner-api.ts`) — beide unter `src/hooks/banner/` |
| Drift-Guards für `src/app/api/cms/webhook/route.ts`, Preview-Route, Middleware, zentraler Renderer | vorhanden — pinnen die Provider-Agnostik dieser Pfade |
| Drift-Guard für `src/hooks/banner/` | **fehlt** — die Ausnahme ist nur als Memory + Code-Kommentar dokumentiert, nicht als automatischer Test |
| Banner-Volltext-Migration im Slice-5-Plan (P4) | **deferred**, nicht durchgeführt |

### AC-Bezug (SHOW-323 §14)

- AC #2.b "UI-Layer (`src/components/`, `src/app/`, `src/hooks/`) enthält keinen `@storyblok/*`-Import mehr" ist mit *einer* dokumentierten Ausnahme verletzt — der Banner-Pfad.

### Was die neue Story leisten muss

1. **Adapter-Pfad bauen** — Option A: Banner ist eine Komponente im Default-Layout (entsprechend Slice-5 P4); Daten kommen via `cms.getLayout(...)` und werden RSC-seitig in den Render-Tree gesetzt. Option B: dedizierter Service-Call (`cms.getBanner(...)`-SPI bereits im Interface vorhanden) wird durchgereicht und vom `top-banner-announcement` Server-Component konsumiert.
2. **Hook entfernen** — `src/hooks/banner/use-banner.ts`, `use-banner.test.tsx`, `storyblok-banner-api.ts` löschen; alle Caller anpassen (heute primärer Caller: das Top-Banner-Mount im Layout).
3. **Drift-Guard ergänzen** — Test, der `@storyblok/*`-Imports unter `src/hooks/**` verbietet (parallel zu den existierenden Drift-Tests für Renderer / Middleware / Preview).
4. **`storyblok-banner-api.test.ts`** retiren und auf die neue Variante anpassen.

### Voraussetzung zum Start

SHOW-323 abgeschlossen.

### Priority

**Hoch** — solange diese Ausnahme existiert, ist AC #2.b "knapp daneben". Risiko: jede künftige Komponente, die auf den Hook-Pfad copy-paste'd, etabliert einen Parallelweg um die Plugin-Architektur herum.

### Scope-Estimate

0,5–1 Tag:
- Layout-Pfad mit `top-banner-announcement`-Komponente: 2-3h
- Hook + Helper löschen + Tests anpassen: 1-2h
- Drift-Guard schreiben: 30min
- Smoke-Verifikation: 1h

### Kontext-Quellen

- `.claude/agent-memory/frontend-developer/feedback_show323_slice4_banner_lib_storyblok_carryforward.md`
- `.claude/SHOW-323-slice-5.md` P4 (deferred Banner-Voll-Migration)
- `src/hooks/banner/storyblok-banner-api.ts` (Code-Kommentar mit "deliberate exception"-Begründung)
- `src/platform/services/cms/CMSService.d.ts` (`getBanner`-SPI bereits vorhanden)
- Bestehende Drift-Guard-Tests unter `src/lib/__tests__/*.drift.test.ts` als Vorbild

---

## (Platz für weitere Folge-Stories)
