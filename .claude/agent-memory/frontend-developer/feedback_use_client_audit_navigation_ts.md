---
name: feedback-use-client-audit-navigation-ts
description: Beim 'use client'-Audit gilt grundsätzlich "der File selbst bestimmt" — ABER für Files, die `Link`/`useRouter`/... aus `@/i18n/navigation` importieren, gibt es eine Sondersituation. `navigation.ts` ruft `createNavigation(...)` beim Modul-Load auf, und `createNavigation` ist eine `'use client'`-Default-Export-Funktion. Wenn der erste Importer von `navigation.ts` aus einem Server-Subgraph kommt, knallt der Build mit "Attempted to call the default export of createNavigation.tsx from the server, but it's on the client".
metadata:
  type: feedback
---

Beim `'use client'`-Audit für Files, die aus `@/i18n/navigation` importieren (`Link`, `useRouter`, `getPathname`, `redirect`, `usePathname`), gilt eine Sonderregel: **Wenn auf dem Aufrufpfad zur Insel KEINE `'use client'`-Mid-Layer existiert, kann das Entfernen der `'use client'`-Direktive den Build crashen.**

**Why:** In SHOW-323 wurden 6 Pattern-A-Inseln (`article-product-link`, `category-link`, `column-teaser-image`, `content-block-button`, `quick-entry-element`, `navigation-item`) als "redundant `'use client'`" gemeldet. Architect-Memo argumentierte mit Server-Components wie `src/components/ui/breadcrumb.tsx` und `src/components/product/product-tile.tsx`, die ebenfalls `Link` importieren ohne `'use client'`. ABER: diese Server-Components werden durch `'use client'`-Wrapper konsumiert (z. B. `src/components/ui/molecules/ui-breadcrumb.tsx` ist `'use client'`), die den Modul-Subgraph für `navigation.ts` ins Client-Side routen. Bei den 6 CMS-Inseln gibt es keinen solchen Mid-Layer-Client-Wrapper — die Parent-CMS-Components (`Article`, `Category`, `Navigation`, etc.) sind selbst Server-Components. Removal der `'use client'`-Direktive auf den Inseln verlegte `navigation.ts` in den Server-Subgraph → Build-Crash `Attempted to call the default export of [project]/src/site/navigation/createNavigation.tsx from the server`.

Build-Test bei `e89d856` (vor Removal): grün. Build-Test bei `01dbf67` (nach Removal aller 6): rot mit obigem Crash. Reproduzierbar mit `npm run build` nach `rm -rf .next`.

Der Wurzel-Grund: `src/i18n/navigation.ts` selber hat **kein** `'use client'`, ruft aber bei Modul-Load `createNavigation(siteRouting, routing)` auf — und `createNavigation` (default-Export aus `src/site/navigation/createNavigation.tsx`) ist `'use client'` und enthält Hook-Aufrufe (`useMemo`/`useLocale`/`useSiteCode`). Next.js wirft erst dann, wenn das Modul tatsächlich im Server-Kontext evaluiert wird.

**How to apply:** Bei jedem `'use client'`-Audit für Files, die aus `@/i18n/navigation` importieren, **zusätzliche Voraussetzung** prüfen: Steht auf dem Aufrufpfad eine `'use client'`-Mid-Layer-Component, die den Modul-Subgraph für `navigation.ts` ins Client-Side routet? Wenn nicht — und der File selber ist die einzige Client-Boundary auf dem Pfad — dann ist die `'use client'`-Direktive **nicht redundant**, sondern strukturell notwendig. **Vor Removal `npm run build` testen, nicht nur Unit-Tests.** Falls der Build crasht, Stop-and-Ask: entweder `'use client'` zurück, oder `navigation.ts` selber zu `'use client'` umbauen (impact-prüfen: 43 Importer, einige Server-only).

Siehe auch [[feedback-use-client-audit]] im Architect-Memory — diese Regel ist eine Verfeinerung für `@/i18n/navigation`-Importer.
