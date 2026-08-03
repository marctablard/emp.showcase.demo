---
name: relative-imports-bypass-modulemapper
description: CMS-Inseln mit relativen Produkt-Imports umgehen die @/-scoped moduleNameMapper-Stubs; Test braucht test-lokales jest.mock auf den relativen Pfad.
metadata:
  type: feedback
---

Die React-Jest-Project moduleNameMapper-Stubs für die heavy Produkt-Kinder sind auf die **`@/`-Alias-Form** gepinnt:
`jest.config.js` → `^@/components/product/product-tile$` und `^@/components/product/product-tile-skeleton$` → `jest/mocks/product-tile*.ts`.

**Why:** Importiert eine Insel diese Kinder **relativ** (z. B. `'../../product/product-tile'` statt `'@/components/product/product-tile'`), greift der Stub NICHT — der echte `ProductTile` mountet und crasht auf `useSiteStore must be used within StoreProvider` (kein StoreProvider im CMS-Test-Setup). Genau das war bei der implementierten `recommendations-carousel.tsx` (SHOW-323 Slice 3) der Fall, obwohl der spec-by-example aus `imported/SHOW-323` `@/`-Alias-Imports voraussetzt.

**How to apply:** Beim Insel-Test, der real mountet, vor dem ersten Render prüfen welche Import-Form die Insel nutzt (`grep "product-tile" <island>.tsx`). Bei relativem Import: test-lokales `jest.mock('../../product/product-tile', ...)` + `...-skeleton` setzen, das die Project-Stubs spiegelt (`data-testid="mock-product-tile"` / `"mock-product-tile-skeleton"`). Das ist rein test-seitig, kein Impl-Fix. Den Import-Style-Mismatch als nicht-blockierende Beobachtung an Architect melden (Empfehlung: auf `@/`-Alias umstellen für Konsistenz) — kein Behaviour-Bug.
