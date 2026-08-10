# Slice 6.3 — Live-Edit-Wiring + TopBanner-Spread-Fix (Storyblok-Vollendung)

> **Branch**: `feature/SHOW-323` (HEAD `7686bd5`, synchron mit `feature/SHOW-323-target`)
> **Modus**: Pro-Slice-Ablauf ohne User-CR
> **Größe**: ~5-7 Files
> **Story-Status**: Korrigiert ein Architect-Versäumnis aus Slice 4 (Live-Edit-Wiring) und schließt einen offenen Spread-Gap aus dem Storyblok-Backend-Smoke (TopBannerAnnouncement).
> **Wichtig**: Styling-Drift-Reverts wurden **ausgekoppelt** in [[SHOW-323-slice-6.4]]. Slice 6.3 ist **rein Storyblok-Integration-Vollendung**.

## Context: warum dieser Slice nicht in Slice 4 erfüllt war

Slice 4 (StoryblokAdapter-Migration, PR #4) hat den vorherigen `<StoryblokProvider>` mit `<StoryblokStory>` aus `@storyblok/react/rsc` (Live-State-Wrapping über `useStoryblokState`) **gelöscht** und nur durch `adapter.BridgeScript`-Script-Loading ersetzt. Dadurch:

- Bridge-Script-Tag wird im DOM injected ✓
- `window.StoryblokBridge` (Konstruktor) ist verfügbar ✓
- `data-blok-c`/`data-blok-uid` auf Wrappern ✓ (via `storyblokEditable()` im Adapter)
- **Bridge-Instanz mit Event-Subscription** ✗
- **Story-State live-update fähig in React-Tree** ✗

Live-Verifikation im Browser (Architect, 2026-05-20, playwright-cli eval):

```
hasStoryblokBridge: "function"  ← Konstruktor da
bridgeScript: true              ← Script-Tag da
useStoryblokState/useStoryblokBridge im src/-Tree: 0 Treffer  ← Hook NICHT verwendet
bridge.on/storyblok.*\.on im src/-Tree: 0 Treffer             ← Listener NICHT registriert
```

Symptom-Match:
- **Live-Edit fehlt**: User editiert Feld im Storyblok-Editor → Storyblok sendet PostMessage `input`-Event → niemand hört → Iframe-DOM bleibt statisch → User muss „Speichern + Reload" für sichtbare Änderung. ✓ User-Report bestätigt.
- **Click-to-Select fehlt**: User klickt im Iframe auf eine Komponente → Bridge-Instanz würde PostMessage zum Parent senden → ohne Instanz keine Message → Editor erkennt Click nicht. ✓ User-Report bestätigt.

Plus testing-engineer-Finding C1 vom Storyblok-Backend-Smoke (TopBannerAnnouncement Spread-Gap): die Komponente nimmt kein `...rest` und propagiert die `editableProps` nicht an das gerenderte Root-Element → 1 von 8 Bloks fehlt der Visual-Editor-Anchor.

Beide Korrekturen werden in einem Slice gebündelt, weil sie dieselbe Boundary haben (Storyblok-Editor-Funktionalität) und gemeinsam die User-Erwartung „Storyblok mit funktionierendem Visual Editor" wiederherstellen.

## Architekt-Entscheidungen (verbindlich)

| # | Entscheidung |
|---|---|
| **LE1** | Live-Edit-Wiring als **Client-Wrapper-Komponente** `src/components/cms/cms-page-client.tsx` (oder analog im Storyblok-Integration-Layer) mit `'use client'`. Server-Component `cms-page.tsx` lädt die initiale Story serverseitig, übergibt sie als Prop an den Client-Wrapper, dieser hält `useStoryblokState(initialStory)` (oder analog je nach SDK-API). |
| **LE2** | **Provider-agnostisch bleiben**: Der Live-Edit-Hook ist Storyblok-spezifisch — er gehört in einen Storyblok-spezifischen Code-Pfad, nicht in die gemeinsame `cms-page.tsx`. Lösung: Adapter erweitert SPI um optionale `LiveEditWrapper?: ComponentType<{ initial; children }>`-Property, ähnlich zu `BridgeScript?: ComponentType`. Storyblok-Adapter liefert den Wrapper, Local-Adapter liefert `undefined` → `cms-page.tsx` rendert mit Wrapper oder ohne. |
| **LE3** | **Aktivierung nur im Preview-Modus**: Live-Edit nur, wenn `_storyblok_tk` in URL → `cms-page.tsx` prüft URL und entscheidet Wrap/No-Wrap. Bei normalen Besuchern: kein Client-Bundle-Overhead, keine Bridge-Init. |
| **LE4** | **Component-Map-Render** bleibt unverändert (`CmsRenderer.tsx`). Der Client-Wrapper rendert nicht selbst, er reicht `story.content.body` an `CmsRenderer` weiter. State-Updates kommen via `useStoryblokState` → Re-Render via React-Diff. |
| **TB1** | **TopBannerAnnouncement Spread-Gap**: Komponente nimmt `...rest`, propagiert es auf das gerenderte Root-Element (`UiLink`/`<a>`). Dadurch `editableProps` (`data-blok-c`, `data-blok-uid`) landen am DOM-Root → 8/8 statt 7/8 Bloks im Storyblok-Backend anchored. |

## Scope (File-Inventar)

### Live-Edit-Wiring (LE1-4)

| Datei | Layer | Änderung | Tests |
|---|---|---|---|
| `src/platform/services/cms/CmsAdapter.d.ts` | Integration | SPI erweitert um optionalen `LiveEditWrapper?: ComponentType<{ initial: unknown; children: ReactNode }>` | Contract-Test |
| `src/platform/integrations/storyblok/cms/impl/StoryblokCmsAdapter.ts` | Integration | liefert `LiveEditWrapper` (verweist auf neuen `StoryblokLiveEditWrapper`) | Unit |
| `src/platform/integrations/storyblok/cms/impl/StoryblokLiveEditWrapper.tsx` | Integration (UI-Helper) | **neu** — `'use client'`, `useStoryblokState(initial)`, propagiert State über Context oder direkt als children-Render-Prop | RTL |
| `src/components/cms/cms-page.tsx` | UI | Server-Component erkennt Preview-Modus via URL-Query `_storyblok_tk`, wrappt body via `adapter.LiveEditWrapper` falls vorhanden. **NICHT in dieser Slice**: Breadcrumb-Restore (separate Slice 6.4). | RTL + E2E |
| `src/components/cms/cms-renderer.tsx` | UI | unverändert — nimmt body[] entgegen | — |

### Top-Banner-Spread-Fix (TB1)

| Datei | Änderung | Tests |
|---|---|---|
| `src/components/cms/top-banner-announcement/top-banner-announcement.tsx` | `...rest`-Spread auf das gerenderte Root-Element | RTL: editableProps (`data-blok-c`, `data-blok-uid`) landen auf dem `<a>`/`UiLink`-Root |

## Tests (Pre-Impl, vor Implementation committet)

Per [[feedback_quality_gates_per_slice]] Pre-Impl-TDD:

1. **Live-Edit Contract-Test** (`StoryblokCmsAdapter.test.ts`): Adapter exportiert `LiveEditWrapper`-ComponentType, das ein `initial`-Prop akzeptiert.
2. **Live-Edit Behavior-Test** (`StoryblokLiveEditWrapper.test.tsx`): bei Bridge-Input-Event wird ein Re-Render mit aktualisierten Story-Daten ausgelöst. Mock-Storyblok-SDK (`@storyblok/react/rsc`-`useStoryblokState`).
3. **Live-Edit Page-Wiring** (`cms-page.test.tsx`): mit `_storyblok_tk` in URL → `LiveEditWrapper` wird gerendert; ohne `_storyblok_tk` → keine Wrapper.
4. **TopBanner-Spread** (`top-banner-announcement.test.tsx`): Component bekommt `data-blok-c="probe"`-Prop → erscheint auf dem gerenderten Root (`<a>`).

Plus Playwright-Browser-Smoke headed (Gate 6):
- `https://localhost:3000/de?_storyblok_tk=...&_storyblok=...` → DOM enthält `data-blok-uid` auf **8/8** Bloks (inkl. TopBanner)
- Bridge-Init verifizieren via `eval`: window hat eine `StoryblokBridge`-Instanz (über `useStoryblokState` instanziiert)
- **Live-Edit-Smoke**: API-Trigger eines Bridge-Event-Simulation, prüfen ob DOM-Diff sichtbar — ODER manuell durch User im headed Browser (Architect-Session `mhammer-storyblok`)
- **Click-to-Select-Smoke**: Click im Iframe auf eine Komponente → Storyblok-Editor-Sidebar reagiert (PostMessage-Bridge-Pfad)

## Verhalten-Constraints

- **Keine Styling-Touches** — Theming-Layer wird nicht angefasst.
- **Keine Token-Touches** in `globals.css`/`mapped.css`/`alias.css`/`brand.css`.
- **Keine Drift-Reverts** in `cms-page.tsx` (Breadcrumb), `richtext/richtext.tsx`, `recommendations/recommendations.tsx` — die landen in [[SHOW-323-slice-6.4]].
- **Backward-compat**: ohne `_storyblok_tk` in URL rendert die App exakt wie zuvor (kein Client-Bundle, keine Bridge-Init, keine `useStoryblokState`-Subscription).
- **Adapter-Pattern bewahren**: SPI-Erweiterung (`LiveEditWrapper?`) ist optional → Local-Adapter implementiert sie nicht → kein Bruch der Provider-Agnostik.

## Quality Gates (alle 10 vor Push)

Spezifika:

- **Gate 6 (Browser-Smoke headed)**: testing-engineer testet Visual-Editor-Live-Edit + Click-to-Select im echten Storyblok-Editor (User-Login persistent in Browser-Session `mhammer-storyblok`, Architect kann mit-evaluieren).
- **Gate 8 (Verhaltens-Pinning)**: Vor/Nach-Snapshot zeigt: ohne `_storyblok_tk` keine Bridge-Subscriptions, normales Render. Mit `_storyblok_tk` Bridge-Init aktiv.
- **Test-Count-Erwartung**: 147 Suites + 3-4 neue Suites → 150-151 Suites.

## Stop-and-Ask-Lagen

- **SDK-API-Variante**: `@storyblok/react/rsc` exportiert `useStoryblokState` oder `useStoryblokBridge` — die exakte API hängt von der Version ab. frontend-developer prüft im `node_modules/@storyblok/react/rsc/dist/`-Index, welche Funktion verfügbar ist und passt LE2 entsprechend an. Bei API-Drift: an Architect zurück.
- **`useStoryblokState`-Subgraph**: falls der Hook intern weitere Client-Module zieht (Bridge-Polyfills, etc.), prüfen, ob das nicht für normale Besucher ohne `_storyblok_tk` ungewollt im Bundle landet. Mitigation: Lazy-Load des Wrappers im Preview-Modus.

## Hand-off

1. **testing-engineer Strategie + Pre-Impl-Modus** (LÄUFT ALS `a6dd09db` mit OLD-Scope inkl. Drift-Tests — Architect filtert beim Übergang auf nur LE1-4 + TB1)
2. **frontend-developer Build-Modus**: iterative Phasen
   - P1: Live-Edit-Wiring (SPI + Adapter + Wrapper + Page-Integration)
   - P2: TopBanner-Spread
3. Cross-Review-Loop (Architect + testing-engineer, sequenziell, bis 0 Findings)
4. Architect Push + PR (`head=feature/SHOW-323`, `base=feature/SHOW-323-target`)
5. User mergt
6. **DANACH**: Slice 6.4 (Styling-Drift-Reverts)

## Lessons-Learned-Anhang (wird nach Slice-Done befüllt)

(leer)
