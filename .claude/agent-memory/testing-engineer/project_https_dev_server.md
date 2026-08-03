---
name: https-dev-server
description: Dev-Server läuft auf HTTPS (npm run dev:https) wegen Storyblok-Visual-Editor; Certs in certificates/, playwright-cli akzeptiert self-signed default.
metadata:
  type: project
---

Lokaler Dev-Server läuft auf `https://localhost:3000` via `npm run dev:https` (Next-`--experimental-https`). Self-signed Certs unter `certificates/localhost.pem` + `localhost-key.pem`, mkcert CA-Root in `~/Library/Application Support/mkcert/`.

**Why:** Storyblok-Visual-Editor erlaubt seit ~2024 nur HTTPS-Preview-URLs. HTTP wird abgelehnt.

**How to apply:**
- Browser-Smoke gegen `https://localhost:3000` testen, nicht http.
- `playwright-cli open` akzeptiert das self-signed Cert by default — kein extra Flag nötig.
- Storyblok-Space-`domain` muss auf `https://...` gesetzt sein, sonst lädt der Visual-Editor-Iframe nicht.
- Bei Iframe-Block-Verdacht (Cross-Origin/Cert): `chrome://flags/#allow-insecure-localhost` aktivieren als erste Diagnose; danach ngrok oder system-trustes mkcert.
- Theme-Override `us-branch.css` liefert das CDN via `/themes/us-branch.css` (cssLink im DOM messbar).

Related: [[storyblok-preview-env]], [[browser-smoke-is-mine]].
