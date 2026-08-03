---
name: app-router-layout-jsdom-routing
description: App-router layout/page tests that render html/body + client providers must be routed to the jsdom "React Tests" jest-project AND need a CSS style-mock; otherwise silent-skip or .css TS-parse crash.
metadata:
  type: feedback
---

App-Router-Tests unter `src/app/**` die `<html>`/`<body>` + Client-Provider rendern müssen ins jsdom-`"React Tests"`-Projekt geroutet werden — und brauchen einen CSS-`moduleNameMapper`.

**Why:** Die `testMatch`-Listen der 4 Jest-Projekte deckten von `src/app/**` nur `app/api/**` + `app/styles/**` ab (beide node-env, Library Tests). Ein Layout-Test unter z. B. `app/preview/**` matchte KEIN Projekt → Silent-Skip (vgl. `test_orphaned-tests`). Außerdem überschreiben die custom-Projekte `moduleNameMapper` und verlieren next/jest's CSS-Handling → `import '@/app/globals.css'` läuft durch `@swc/jest` als TS und crasht.

**How to apply:** Beim Pre-Impl-Test für ein App-Router-Layout/Page mit DOM-Render:
1. `testMatch`-Eintrag im "React Tests"-Projekt ergänzen (z. B. `'**/app/preview/**/?(*.)+(spec|test).ts?(x)'`).
2. CSS-Mapping `'\\.(css|scss|sass)$': '<rootDir>/jest/mocks/style-mock.js'` VOR dem `^@/(.*)$`-Fallback einsetzen (first-match-wins) — `jest/mocks/style-mock.js` existiert seit EMP-25.
3. Async Server-Layout wird via `await import(...)` + `await Layout({children, params: Promise.resolve(...)})` gerendert; `render(ui)` und Tree-Queries über `container.querySelector('html'|'[data-provider]')`.
4. Jest/swc typecheckt nicht → tsc-Gate laufen (siehe [[tsc-gate-over-tests]]).

Verwandt: [[emp22-preview-layout-test-paths]], [[use-client-not-jest-catchable]] (RSC-Boundary-Fehler bleiben jsdom-No-op).
