---
name: feedback-show323-cms-page-shell-untested-route-wired
description: SHOW-323 _core/cms-page.tsx ist eine route-verdrahtete async-RSC-Shell mit Branch-Logik (notfound x emptyOnNoResult, no_margin) + ssr.get-Boundary — braucht dedizierten Test, nicht als "präsentational" durchwinken.
metadata:
  type: feedback
---

`src/components/cms/_core/cms-page.tsx` ist eine async-RSC-Shell, die in beide `(no-margin)`-Route-Entrypoints (`page.tsx` + `[...slug]/page.tsx`) verdrahtet ist und vier echte Branches trägt: notfound+emptyOnNoResult→leere Div, notfound+!empty→notFound(), kein components-Feld→notFound(), no_margin-Klassen-Toggle + components.map. Sie holt via `ssr.get('CMSService')` über die Server-Boundary.

**Why:** Im Slice-4-Cross-Review war das die einzige echte Reverse-Coverage-Lücke (HEAD c5db1114): neu in e96a5a7b, von keinem Test getroffen. Die Build-Mode-Ausnahme "rein präsentationale Stateless-Component" greift NICHT — Branching + Service-Boundary. `page/page.test.tsx` matcht nur den Substring "cms-page" narrativ, deckt die Shell nicht ab (false positive beim grep).

**How to apply:** Eine RSC-Shell mit notfound/empty-Branch-Matrix oder no_margin-Toggle als untestbar-präsentational einzustufen ist falsch. Beim Reverse-Coverage-Check: route-verdrahtete async-Shells mit `ssr.get`/`notFound()` brauchen entweder dedizierten Test (CMSService + next/navigation gemockt) oder explizite Architect-Freigabe als E2E/Route-abgedeckt. grep auf Test-Refs immer gegen den vollen Pfad (`_core/cms-page`), nicht den Substring `cms-page`. Siehe [[feedback-cross-review-discipline]].
