---
name: show323-storyblok-token-present-alias-unbound
description: Slice-2 Smoke mit Storyblok-Token zeigt grünes 200 OK Shell-Render aber CMS-Body leer, weil CmsAdapter-Alias trotz konfiguriertem Provider nicht im DI-Container gebunden wird.
metadata:
  type: feedback
---

`/` rendert HTTP 200 mit kompletter Header+Footer-Shell (125 KB HTML, Title `Emporix Showcase Store`, Breadcrumb `Home > Home`), aber der CMS-Body ist leer: `<div class="mx-auto" blok="[object Object]"><div class="space-y-8"></div></div>` — Storyblok-`{blok}`-Prop-Shape leakt sogar als HTML-Attribut.

Server-Log-Beweis (Boot-Warning, kein Render-Crash):
`{"level":40,"providerId":"storyblok","cmsAdapterTarget":"CmsAdapter:storyblok","msg":"CMS adapter target not bound — CmsAdapter alias not registered"}`

**Why:** Slice 2 hat Schemas/Wrapper auf flat `<Name>Data` migriert, aber `lib/storyblok.ts`-Registrierung + Page/ContentBlock-Wrapper bekommen weiterhin Storyblok-`{blok}`-Shape; gleichzeitig erreicht der Container-Bootstrap die CmsAdapter-Alias-Binding nicht (entweder Module-Graph-Split à la [[feedback_di_container_module_graph_split]] oder Bootstrap-Sequence-Lücke à la [[feedback_show323_container_bootstrap_sequence]]).

**How to apply:**
- Slice-2-Carry-Forward ist **non-fatal**: kein 5xx, kein Error-Boundary, keine Render-Exception — Shell rendert vollständig, nur CMS-Body und Direct-Storyblok-Components leer.
- Slice 4 muss zwei Dinge fixen: (1) Wrapper-Shape-Migration auf flat Data, (2) CmsAdapter-Alias-Bootstrap mit Storyblok-Provider verifizieren.
- Wenn Phase-B-Architect Slice-2-State als "akzeptable Carry-Forward" einstuft, ist diese Memory der Beweis. Wenn nicht: Strategie-Reset auf Slice 2 mit Wrapper-/Bootstrap-Update vorziehen.
- DOM-Leak `blok="[object Object]"` ist ein Wrapper-Spread-Bug — Mitigation siehe [[feedback_storyblok_blok_dom_leak]].
