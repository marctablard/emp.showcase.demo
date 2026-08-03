---
name: test-real-edge-runtime-not-just-mocks
description: HARTE Regel — Middleware-/Edge-Routing-Tests müssen Production-Build-Smoke einschließen, nicht nur Jest-Mocks mit vanilla URLs. Mocks decken Edge-Runtime-Quirks nicht ab.
metadata:
  type: feedback
---

**Regel**: Bei Middleware- oder Edge-Routing-Logik darf der Test-Suite-Pass NICHT als alleiniger Acceptance-Beweis gelten. Es braucht zusätzlich einen **Production-Build-Live-Smoke** (`next build && next start` + curl/Playwright), bevor man approve sagt.

**Why** — In einem Slice rund um Storyblok-Editor-Routing-Refactor sind **drei aufeinanderfolgende Routing-Bugs** durch Jest-Tests gerutscht und erst im Live-Smoke aufgetaucht:

1. **Folder-Underscore-Bug**: `src/app/_editor/...` wurde von Next.js als Private-Folder behandelt (kein Routing). Tests grün, weil sie nicht über Next-Router gingen.
2. **NextURL-vs-URL-Bug**: `req.nextUrl instanceof URL` ist in Edge-Runtime false (NextURL-Class). Tests benutzten vanilla `new URL(...)`-Mocks → `instanceof URL` true → Detection feuerte. Live: false → Detection failte.
3. **Site-Prefix-Bug**: Pre-Impl-Test pinnte rewrite zu `/editor/de`, aber Editor-Route ist `/editor/[site]/[locale]` (zwei Segmente nötig). Test ging mit URL-Mock `/main/de/home` (mit explizitem Prefix), Live-URL hatte aber kein Prefix (Storyblok-Editor-Iframe). Tests grün, Live-Route 404.

Jeder einzelne Bug hätte mit einem 30s-Live-Smoke nach Implementation erkannt werden können.

**How to apply — verbindlich:**

1. **Im Plan-Output Sektion 8 (Akzeptanzkriterien)** für jeden Slice mit Middleware/Routing/Edge-Touchpunkten:
   > [ ] `npm run build && next start` läuft erfolgreich, kritische Routen liefern erwartete HTTP-Status + DOM-Marker.
   
2. **Im Pre-Implementation-Test-Strategie-Review** (testing-engineer): bei Middleware-Tests explizit fragen — *werden die Edge-Runtime-spezifischen Objekt-Shapes (NextURL, NextResponse) simuliert, oder nur vanilla URL/Response?* Wenn nur vanilla: Smoke-Plan erforderlich.

3. **Im Cross-Review-Gate vor Approve**: bei jedem Slice, der eine Middleware oder Page-Route ändert, ist ein **lokaler Production-Build-Smoke verbindlich** — entweder durch den Developer im Implementation-Brief, oder durch den Architect im Cross-Review.

   **3a. `next dev` zählt NICHT als Production-Build-Beweis.** Sub-Agents nehmen den nächstbesten laufenden Server, wenn nicht explizit anders instruiert — Slice 8 Engineer A62 hat trotz Brief-Anweisung `next build && next start` einfach den schon laufenden `next dev`-Server abgegriffen. Brief muss daher zwei Bedingungen explizit nennen:
   - `next build` muss frisch innerhalb des Slice-Smoke-Schritts laufen (BUILD_ID-Beweis im Output verlangen)
   - Wenn ein anderer Prozess Port 3000 belegt: **anderen Port wählen** (`next start -p 3010`), NICHT auf den bestehenden Server zugreifen
   
   Eskalations-Prüfung: bei der Output-Validierung des Sub-Agents nach `BUILD_ID` und nach Marker `[HMR]` / `next-server (dev)` greifen — letztere zwei sind dev-Marker und disqualifizieren den Run.

4. **Test-Path-Patterns abdecken**: bei URLs die per Routing-Convention transformiert werden (`/de` → `/main/de` via Site-Resolution), müssen Tests **beide Pfade** simulieren (mit + ohne Prefix). Nicht nur die "happy-path"-Form mit allen Segmenten.

5. **Build-Manifest als CI-Gate**: für Folder-Convention-Bugs (`_`-Präfix, `(group)`, `@parallel`) ist ein einfacher Build-Manifest-Check sinnvoll (lese `.next/routes-manifest.json` und assert dass erwartete Routen vorhanden sind). Empfehlung: separater kleiner Slice für CI-Pipeline-Härtung.

Gilt für: alle Next.js-App-Router-Slices mit `src/middleware.ts`, `src/site/middleware.ts`, Route-Tree-Touches, oder `next-intl`-Provider-Hierarchien.
