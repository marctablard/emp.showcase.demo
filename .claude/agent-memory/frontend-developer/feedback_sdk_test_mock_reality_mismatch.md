---
name: feedback-sdk-test-mock-reality-mismatch
description: Wenn ein Modul-Mock vom Brief vorgegeben ist und die SDK-Signatur in .d.ts ein anderes Shape liefert (z.B. Accessor vs direkter Client), grünes Jest != Production-Greenness. Vor Pre-Impl-Tests SDK-Signatur in node_modules-.d.ts crosschecken.
metadata:
  type: feedback
---

Wenn der Brief einen `jest.mock(...)` mit einem bestimmten Shape vorgibt (`mockReturnValue({ get: fn })`), heißt das nicht, dass dieses Shape mit der echten SDK-Signatur übereinstimmt. Bei `@storyblok/react/rsc.storyblokInit` z.B. ist die Signatur `(opts) => (() => StoryblokClient)` — ein Accessor — der Mock im Brief liefert aber einen direkten Client. Jest grün, Produktion crasht mit `api.get is not a function`.

**Why:** EMP-21 Phase C — Pre-Impl-Test + Impl beide gegen direkten Client gebaut (Architect-Plan + sub-agent), kein Crosscheck mit `node_modules/@storyblok/react/dist/rsc.d.ts:139`. Bestandscode `StoryblokCmsApi.ts:74-90` hat das richtige Accessor-Pattern bereits — wäre als Referenz im Repo da gewesen. Architect-Cross-Review fing's nach dem Impl-Commit ab → 1-Commit-Bugfix nötig.

**How to apply:** Vor jedem Pre-Impl-Test, der eine externe SDK mockt, einmal die `.d.ts` in `node_modules/<pkg>/dist/` lesen UND nach existierenden Aufrufstellen im Repo greppen (`Grep "storyblokInit\("`-Pattern). Falls Bestandscode die SDK schon nutzt: dessen Wrapping-Pattern (Accessor-Cast, Memoisation etc.) übernehmen, nicht neu erfinden. Falls der Brief ein abweichendes Mock-Shape vorschlägt: **Stop-and-Ask beim Architect** mit Beweis aus `.d.ts` + Bestandscode-Pfad, bevor man rote Tests schreibt.
