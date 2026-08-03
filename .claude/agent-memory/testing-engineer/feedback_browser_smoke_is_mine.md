---
name: browser-smoke-is-mine
description: Browser-Smoke ist Pflicht-Aufgabe des testing-engineer (nicht des architect). playwright-cli ist global verfügbar, dev:next muss aus Background laufen, 404-Asset-Errors + 500-Endpoint-Errors sind Findings.
metadata:
  type: feedback
---

Browser-Smoke ist meine (testing-engineer) Pflicht, nicht des architect.

**Why:** User hat in SHOW-323 Slice 3 finalem Cross-Review-Iteration neu klargestellt: testing-engineer hat Bash-Zugriff und kann `playwright-cli` als globales CLI nutzen. Verlagerung weg vom architect war explizite Direktive.

**How to apply:**

1. `dev:next` mit `run_in_background: true` starten (NICHT mit `&` — das interagiert mit dem Bash-Tool-Capture und beendet den Job). Setup:
   ```bash
   # FALSCH (Background-Job bricht ab):
   NEXT_PUBLIC_CMS_PROVIDER=mock npm run dev:next > /tmp/dev.log 2>&1 &
   # RICHTIG (mit run_in_background-Flag):
   # Bash-Tool aufrufen, command="NEXT_PUBLIC_CMS_PROVIDER=mock npm run dev:next 2>&1", run_in_background=true
   ```

2. Bis-ready-poll mit `curl -L` (follow redirects), nicht ohne — die App schickt 307 von `/main/de` zu `/de` (Locale-Middleware) oder ähnlich. `curl -sf` mit `-L` gibt finalen 200.

3. **HEAD-Requests gegen `/main/de` werden vom Health-Check-Middleware abgefangen** → `x-misrouted-healthcheck: 1`-Header und Plain-Text-Response statt HTML. Smoke immer mit GET (also `playwright-cli goto`, nicht `curl -I`).

4. **playwright-cli Snapshot-Output dokumentiert in `.playwright-cli/page-<timestamp>.yml`** — YAML-Tree der DOM-Struktur mit `[ref=eXX]`-IDs. Zum Klicken ein `ref` aus dem Snapshot nehmen.

5. **Console-Errors per `playwright-cli console`**. Jede unerwartete Error-Zeile = Finding. Asset-404s (z. B. Public-Image-Pfad existiert nicht) und API-500 (z. B. Endpoint hat den Service-Resolution-Bug nicht gefixt) sind beide Blocker.

   **Wichtig — `playwright-cli console` ohne Level-Argument filtert auf `info`-Level (sieht Warnings NICHT vollständig)**: das "Total messages: X (Errors: 0, Warnings: 0)" im Output ist nur der grobe Zähler. Um Warnings sicher zu sehen, immer **zusätzlich** `playwright-cli console warning` aufrufen. Das fängt z. B. Next-Image-`fill`-without-`sizes`-Warnings, die Slice-3-Fixture-Expansion plötzlich sichtbar machen kann.

6. Mindestens 1 Pattern-A-Insel klicken — Snapshot vor + nach bestätigt Reaktivität (`/de/contact`-Navigation z. B.).

7. Aufräumen: `pkill -f "next dev"` + Port 3000 frei.

Konkret-erkannte Bug-Klassen aus dem ersten Browser-Smoke:
- **Fixture verweist auf nicht-existierende Public-Assets** (`/images/cms/home/hero.jpg`, `/videos/cms/home/intro.mp4`) → 404-Triple wegen Next-Image-Pipeline.
- **Fake-Produkt-IDs in Fixture, die ein Live-Hook aus dem Renderer aufruft** → 404 auf `/api/products/sample-product-1,...`.
- **API-Endpoint-Inkonsistenz mit Render-Path**: `/api/cms/route.ts` hat den `getCmsService()`-Lazy-Bind-Fix NICHT bekommen, ruft direkt `ssr.get<CMSService>('CMSService')` → `No bindings found for service: "CmsAdapter"` als 500-Error. Der Render-Path über `getCmsService()` ist gefixt, der API-Path nicht.
