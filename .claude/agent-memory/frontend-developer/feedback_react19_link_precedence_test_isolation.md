---
name: feedback-react19-link-precedence-test-isolation
description: React 19 hoistet `<link>` mit `precedence`-Prop in `document.head` und dedupliziert by `href`. Im Component-Tree-Test landet das Element NICHT im `container` — Test-Isolation bricht. Entscheidung pro File: `precedence` weglassen, wenn Cascade-Position via Mount-Point ausreichend ist; sonst Test-Strategie auf `document.head` umstellen mit per-test reset.
metadata:
  type: feedback
---

React 19's stylesheet-precedence API hoistet `<link rel="stylesheet" precedence="...">` in `document.head` und dedupliziert by `href`. In RTL-Tests:

- `container.querySelector('link')` findet das Element **nicht** — es ist nicht im Render-Container, sondern in `document.head`.
- Mehrere Test-Renders innerhalb derselben Datei akkumulieren `<link>`s in `document.head` (Doku-Level-State), bis ein expliziter `beforeEach`-Reset oder `cleanup()` greift. RTL's `cleanup()` räumt nur den Container auf, nicht `document.head`.

**Why:** In SHOW-323 Slice 6 (`<SiteThemeStyle>`) hatte ich `precedence="site-theme"` gesetzt, weil das die idiomatische React-19-Lösung für Stylesheet-Hoisting ist. Tests scheiterten alle `container.querySelector('link[rel="stylesheet"]')`-Assertions. Probe-Test (`render(<link rel="stylesheet" href="/foo.css" precedence="x" />)`) hat es bestätigt: container leer (`<div></div>`), `document.head` enthält das Element + zusätzliches `<link rel="preload" as="style">`-Element.

**How to apply:**

Bei jedem `<link rel="stylesheet">`-Mount in einem Component:

1. **Brauche ich Hoisting + Dedup?** Wenn die Komponente mehrfach im Tree gemountet werden könnte und ich Dedup will: `precedence` setzen. Wenn die Komponente nur einmal pro Page-Render gemountet wird (z. B. Layout-Mount): `precedence` weglassen.
2. **Wenn `precedence` nötig**: Test-Strategie auf `document.head` umstellen, mit `beforeEach(() => { document.head.querySelectorAll('link[rel="stylesheet"]').forEach(l => l.remove()) })` oder einem ähnlichen Reset. RTL's `cleanup()` reicht nicht.
3. **Wenn `precedence` weggelassen**: `<link>` rendert im Component-Tree, Tests prüfen `container.querySelector('link')` direkt. HTML5 erlaubt `<link rel="stylesheet">` im `<body>`, Browser laden es ganz normal — und die Cascade-Position ist sogar besser (nach `<head>`-CSS), was für Override-Slot-Designs (Per-Site-Theming) exakt gewünscht ist.

**Production-Implication für Cascade-Order**: Mit `precedence` hoistet React den `<link>` in `<head>`. Reihenfolge dort hängt von React-Precedence-Sortierung ab. Ohne `precedence` rendert der `<link>` im Body — Reihenfolge ist deterministisch nach Mount-Position im Component-Tree. Für Override-Patterns, wo "später-in-Position wins" das Design-Ziel ist, ist Body-Position **gewollt**.
