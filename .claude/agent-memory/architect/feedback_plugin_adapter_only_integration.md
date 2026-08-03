---
name: feedback-plugin-adapter-only-integration
description: Verbindliche Architektur-Maßgabe — Integration eines neuen CMS (allg. Plugin-Provider) darf AUSSCHLIESSLICH einen neuen Adapter erfordern. Applikationslogik (zentraler Renderer, Services, UI) bleibt unverändert. Entscheidungs-Regel für jede Plugin-Architektur-Frage.
metadata:
  type: feedback
---

**Die Maßgabe (User-Direktive 2026-05-27, nicht verhandelbar):**

Die Integration eines neuen CMS-Providers (verallgemeinert: jedes austauschbaren Plugins) darf **ausschließlich** das Schreiben eines neuen Adapters erfordern. Die **Applikationslogik muss unverändert bleiben** — insbesondere der zentrale Renderer, die component-map, die Services und die UI-Schicht. Der Adapter übersetzt das Provider-spezifische Wire-Format in das agnostische Domain-Modell (`CMSPage`); der Rest der App kennt nur das agnostische Modell.

Über den Adapter-Umfang kann man reden (eine Datei vs. Ordner mit Mapper/API/Bridge). Worüber man NICHT reden kann: die App-Logik bleibt gleich, wenn sich das CMS ändert.

**Entscheidungs-Regel für jede „central vs. provider-owned"-Architektur-Frage:** Prüfe — muss für ein neues Plugin Applikationslogik (Renderer/Service/UI) angefasst werden? Wenn JA → die betroffene Logik gehört in den Adapter. Wenn NEIN → die geteilte zentrale Logik ist legitim.

**Why:** Provider-Agnostik ist das load-bearing Akzeptanzkriterium der CMS-Architektur (SHOW-323). Ein neuer Provider (Contentful, Sanity, …) soll ein reines Adapter-Add sein, ohne Risiko für die bestehende App.

**How to apply:**
- Bei Architektur-Entscheidungen im Plugin-Bereich (Renderer-Strategie, SPI-Design, Daten-Fluss) ist diese Maßgabe das Kriterium — nicht „was macht die Vorlage".
- Festgehalten als **`docs/adr/0001`** im Repo (Titel: „CMS providers are integrated solely through adapters").
- Test-erzwungen via Drift-Guard: der zentrale Renderer (`_core/cms-renderer.tsx`, `_core/cms-page.tsx`) darf keine `@/platform/integrations/*`-Provider-Imports enthalten.
- Konkret in showcase erfüllt durch: central-renderer + component-map (agnostisch), Adapter = reines `getPage()→CMSPage`-Daten-Mapping, Storyblok-Spezifika nur über optionale SPI (`getEditableProps`/`BridgeScript`).
- Gilt analog für künftige Plugin-Achsen (Payment-Provider, Search-Provider etc.): neues Plugin = neuer Adapter, App-Logik unangetastet, sonst Drift-Guard.
