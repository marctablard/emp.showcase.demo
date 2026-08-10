---
name: feedback-use-client-audit
description: Beim 'use client'-Audit zählt nicht nur "nutzt dieser File selbst Hooks/Browser-API/Event-Handler". Auch Module-Subgraph-Trigger-Logik ist relevant — ein File kann strukturell als einziger 'use client'-Marker auf einem Konsumenten-Pfad nötig sein, um einen Client-Modul-Subgraph zu etablieren, der einen 'use client'-Default-Export-Factory-Call beim Module-Load legal macht.
metadata:
  type: feedback
---

Beim `'use client'`-Audit gilt: **`'use client'` ist gerechtfertigt entweder weil (1) der File selber Hooks/Browser-API/Event-Handler nutzt, ODER weil (2) der File als Subgraph-Trigger nötig ist.**

**Punkt 1 — direkter Bedarf**: File nutzt `useState`/`useEffect`/`useRef`/`useMemo`/`useCallback`/`useContext`, Browser-API (`window.`/`document.`/`localStorage`/`sessionStorage`/`navigator.`), Event-Handler-Props (`onClick`/`onChange`/`onSubmit` an DOM-Elementen) oder Custom-Hooks, die das transitiv tun. → `'use client'` nötig.

**Punkt 2 — Subgraph-Trigger-Bedarf** (subtil): Ein File importiert direkt/transitiv ein Modul, das beim Module-Load eine Factory-Funktion mit einem `'use client'`-Default-Export aufruft. Beispiel im Codebase: `src/i18n/navigation.ts` (nicht `'use client'`) macht beim Load `createNavigation(...)`, wobei `createNavigation` ein `'use client'`-Default-Export ist. **Damit dieser Factory-Call legal ist, muss das gesamte Konsumenten-Pfad-Modul in einem Client-Modul-Subgraph leben.** Wenn kein anderer Konsument auf dem Pfad `'use client'` ist, muss der Aufrufer es markieren — sonst Build/Dev-Server-Crash beim Module-Load (`"Attempted to call the default export of createNavigation.tsx from the server, but it's on the client."`).

**Why:** In SHOW-323 Slice 3 hatte ich 6 Pattern-A-Inseln (article-product-link, category-link, column-teaser-image, content-block-button, quick-entry-element, navigation-item) im Cross-Review als "redundantes `'use client'`" markiert, weil sie nur `Link` aus `@/i18n/navigation` importieren und rendern, ohne eigene Hooks. Ich habe `breadcrumb.tsx` und `product-tile.tsx` als Beweis genommen, dass das geht — beide sind Server-Components und nutzen Link.

Das war zur Hälfte richtig. **Was ich übersehen habe**: `breadcrumb.tsx` wird von `ui-breadcrumb.tsx` (`'use client'`) konsumiert; `product-tile.tsx` wird von `recommendations-carousel.tsx` (`'use client'`) und anderen Client-Komponenten konsumiert. Auf dem Konsumenten-Pfad existiert also bereits ein Client-Subgraph-Trigger — `navigation.ts` landet automatisch im Client-Subgraph.

Die 6 CMS-Inseln hingegen werden von Server-Component-Parents (Article, Category, Navigation, QuickEntry, ColumnTeaser, ContentBlock) konsumiert. Da gibt es **keinen** Client-Mid-Layer. Wenn man `'use client'` aus den Inseln entfernt, kollabiert der gesamte Pfad zu Server, `navigation.ts` läuft Server-seitig in den `createNavigation()`-Aufruf — und der Build crasht.

Beweis im Repo per `npm run build` und `npm run dev:next` durchgespielt — beide krachten deterministisch nach Removal, beide grün nach Restore.

**Konsequenz für unnötig markierte `'use client'`-Files**: zwar größerer Client-Bundle, aber **strukturell notwendig** wenn kein anderer Client-Trigger auf dem Pfad ist. Die "redundante `'use client'`"-Sprache war falsch.

**How to apply:** Bei jedem `'use client'`-Audit pro File diese Checkliste durchgehen:

1. Hat der File `useState`/`useEffect`/`useRef`/`useMemo`/`useCallback`/`useContext` (oder Custom-Hooks, die das transitiv nutzen)? → ja: `'use client'` nötig.
2. Hat der File `window.`/`document.`/`localStorage`/`sessionStorage`/`navigator.`-Zugriffe? → ja: `'use client'` nötig.
3. Hängt der File Event-Handler an DOM-Elemente (`onClick={}`, `onChange={}`, `onSubmit={}` etc.)? → ja: `'use client'` nötig (oder Insel extrahieren).
4. Wenn (1)-(3) alle nein: **Subgraph-Trigger-Check**:
   - Importiert der File direkt oder transitiv ein Modul, das beim Module-Load eine Factory-Funktion mit `'use client'`-Default-Export aufruft? (Beispiel: `@/i18n/navigation` → `createNavigation(...)`)
   - Wenn ja: Wer konsumiert diesen File? Wenn der **direkte Aufrufer** (oder einer dessen Konsumenten) bereits `'use client'` ist, ist der Subgraph bereits Client → kein `'use client'` am eigenen File nötig.
   - Wenn **kein** Konsument auf dem Pfad `'use client'` ist: dann ist der eigene File als Subgraph-Trigger nötig → `'use client'` markieren, mit JSDoc-Begründung, die das **strukturell**, nicht oberflächlich ("Link is a client export") erklärt.
5. Wenn (1)-(3) nein und (4) auch nein: `'use client'` nicht nötig.

**Verifikation immer durch echten Build**: `npm run build` ODER `npm run dev:next` + Page-Load. Module-Subgraph-Logik ist Compile-Zeit-Verhalten, das von keinem Unit-Test/Lint gefangen wird. Wenn du `'use client'` entfernen willst und der Build danach läuft, ist die Removal sicher. Wenn nicht, war's strukturell nötig.

Konkrete Disziplin beim Hand-off an `frontend-developer`: bei `'use client'`-Removal-Audits ist **`npm run build` Teil der Quality Gates pro Commit**, nicht nur `npm test`. Bei Pattern-A-Insel-Audits ist die Frage "wer konsumiert diese Insel und welche `'use client'`-Marker liegen auf dem Pfad" Teil des Pre-Audits.
