---
name: feedback-show323-carousel-relative-product-import
description: SHOW-323 recommendations-carousel island imports product children via relative path, defeating the jest @/-alias product-tile mock
metadata:
  type: feedback
---

`recommendations-carousel.tsx` importiert seine Product-Children via relativem Pfad (`../../product/product-tile`, `../../product/product-tile-skeleton`) statt via `@/components/product/...`-Alias wie der Rest des Codebase.

**Why:** Die jest React-Project-`moduleNameMapper` stubbt `^@/components/product/product-tile$` -> `jest/mocks/product-tile.ts`. Ein relativer Import matcht das Pattern NICHT, deshalb muss `recommendations-carousel.test.tsx` die Children erneut per `jest.mock('../../product/product-tile', ...)` mocken (Doppel-Mock). Funktional grün, aber inkonsistent + Wartungsfalle: wer den Insel-Import auf `@/`-Alias normalisiert, kann die test-lokalen Mocks entfernen, und wer den Mock entfernt ohne den Import zu fixen zieht den vollen Zustand-Provider-Stack rein.

**How to apply:** Bei Slice-4-Cleanup oder neuen CMS-Inseln, die Product-Children rendern: `@/components/product/*`-Alias-Imports nutzen, damit die zentralen jest-Mocks greifen. Nicht-blockierend (testing-engineer hat es als Import-Style-Hinweis markiert).
