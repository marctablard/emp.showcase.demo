---
name: e2e-env-gate-documentation
description: Env-gated E2E (E2E_CMS_NO_TOKEN, E2E_AUTH_SITE_SYNC) laufen in CI nicht automatisch — Test-Vertrag erfüllt sich nur durch dokumentierten Smoke-Lauf. AC #1 hängt am Smoke-Schritt, nicht am `npm run jest`.
metadata:
  type: feedback
---

Env-gated Playwright-Tests wie `e2e/cms-no-token.spec.ts` (`test.skip(process.env.E2E_CMS_NO_TOKEN !== 'true', ...)`) sind in CI-Standardläufen geskippt. Sie sind kein Regressions-Netz, sondern eine Smoke-Lauf-Hilfe für den Tester.

**Why:** in `playwright.config.ts` gibt es keinen separaten Project/Tag, der den Gate-Wert aktiviert; in `package.json` kein Script, das ihn setzt. Damit liegt die Last beim Operator (Architect / testing-engineer), den Lauf einmal lokal/in einem dedizierten Job auszuführen — ohne diesen Lauf erfüllt die Suite AC #1 nicht.

**How to apply:** (1) Beim Plan eines env-gated E2E die Ausführungsmechanik mitliefern (z. B. `package.json`-Script `e2e:cms-no-token` oder ein CI-Job-YAML-Snippet). (2) Im Test-Vertrag explizit notieren: "Test ist Vertrag für lokalen Smoke, nicht für `npm run jest`-Lauf." (3) Für CI-Coverage ergänzende Jest-Integrationstests anstreben, die das Verhalten ohne Browser nachbilden — z. B. einen Resolver-/instrumentation-test, der das `providerId='none'`-Pfad-Verhalten dokumentiert.

Beziehung: [[browser-smoke-is-mine]] — Browser-Smoke ist testing-engineer-Pflicht; env-gates verschieben den Smoke nur, ersetzen ihn nicht.
