---
name: feedback-show323-htmlattributes-style-clash
description: SHOW-323 Slice 2 — Schema-Literal-Felder mit gleichem Namen wie HTMLAttributes-Keys (style, color, ...) brauchen Omit<...>.
metadata:
  type: feedback
---

Wenn ein CMS-Schema ein Feld mit gleichem Namen wie ein HTMLAttributes-Key hat (z.B. `style: 'vignette' | 'full-width' | 'teaser'`), kollidiert die Intersection `<Schema> & HTMLAttributes<HTML*>` und TS-strict baut intersection types wie `"full-width" | ("vignette" & CSSProperties) | ("teaser" & CSSProperties)`. Lookup mit so einem Index ist `any` → TS7053.

Fix: `<Schema> & Omit<HTMLAttributes<HTML*>, 'style'>` (oder die jeweilige Kollisionskey). Jest/swc toleriert das nicht-omitted Pattern, `next build` (tsc) hartet rejecten.

**Why:** Slice-2 `ContentBlock`-Spread-Vertrag verlangt HTMLAttributes-Spread aufs Root, aber der CMS-Author kennt einen `style`-String. Inline-CSSProperties auf einer CMS-Komponente sind ohnehin kein Use-Case der Adapter-Layer.

**How to apply:** Bei jedem Co-Location-Schema in Slice 3 prüfen, ob ein Feldname mit `HTMLAttributes`-Keys (style, color, hidden, draggable, contentEditable, ...) clasht — wenn ja, in `<Name>Props` ein `Omit<HTMLAttributes<...>, '<keyname>'>` setzen und im Kommentar dokumentieren, warum.

Beispiel: `src/components/cms/content-block/content-block.tsx` Commit `aead7ca4`.
