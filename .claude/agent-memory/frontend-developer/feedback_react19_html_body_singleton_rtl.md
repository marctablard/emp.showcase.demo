---
name: feedback_react19_html_body_singleton_rtl
description: React 19 hoists <html>/<head>/<body> to document singletons; RTL root-layout tests must assert lang/attrs on document.documentElement, never container.querySelector('html').
type: feedback
---

Beim Testen eines **Root-Layouts** (das echtes `<html lang>`/`<body>` rendert) mit RTL: `container.querySelector('html')` / `querySelector('body')` ist **immer `null`** — für jede korrekte Impl.

**Why:** React 19 behandelt `<html>`, `<head>`, `<body>` als **Document-Singletons** (`resolveSingletonInstance`). Beim `render()` werden ihre Attribute auf das **echte** `document.documentElement` / `document.body` aufgelöst; nur die **Kinder** von `<body>` landen im RTL-Container. Zusätzlich loggt React eine `validateDOMNesting`-`console.error` ("`<html>` cannot be a child of `<div>`") — die ist im jsdom-Render eines Root-Layouts unvermeidbar und harmlos (Tests bleiben grün).

Empirisch belegt (Probe React 19 + RTL):
- `container.querySelector('html')` → `null`
- `document.documentElement.getAttribute('lang')` → korrekt gesetzt (`en`), Font-Klassen auf `className`
- `document.body.className` → gesetzt
- `container.querySelector('[data-provider="..."]')` → gefunden (Body-Kinder im Container)

**How to apply:** In Layout-RTL-Tests die `<html>`/`<body>`-Presence + `lang`/`className` auf `document.documentElement` / `document.body` assert'en. Provider-Ketten / Reihenfolge / `data-*` weiter über `container` prüfen — die sind im Container. Falle nur im **grünen** Pfad sichtbar (ein Stub ohne `<html>` failt aus anderem Grund), darum beim Schreiben eines roten Akzeptanz-Tests gegen ein Root-Layout mitdenken. Verwandt, aber anderer Mechanismus: [[feedback_react19_link_precedence_test_isolation]] (`<link precedence>` → `document.head`). Begegnet in SHOW-323 / EMP-22 (Preview-Layout-Provider-Stack), `src/app/preview/[site]/[locale]/[[...slug]]/__tests__/layout.test.tsx`.
