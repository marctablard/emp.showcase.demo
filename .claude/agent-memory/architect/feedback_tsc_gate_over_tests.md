---
name: feedback-tsc-gate-over-tests
description: tsc --noEmit über das GESAMTE Projekt (inkl. Test-Files) ist Pflicht-Quality-Gate. jest (swc) und next build fangen Type-Errors in Test-Files NICHT.
metadata:
  type: feedback
---

`npx tsc --noEmit` über das gesamte Projekt (inklusive `*.test.ts`/`*.test.tsx`) ist ein verbindliches Quality-Gate vor jedem PR — zusätzlich zu jest, lint, build.

**Why:** 2026-05-27 in Phase C (Slice 4) entdeckt: `NullCmsAdapter.test.ts` trug seit Phase B' (`5fc16f3d`) zwei `TS2339`-Errors (Zugriff auf optionale SPI-Methoden via konkretem Adapter-Typ). Sie rutschten durch PR #1, #2, #3, weil:
- `npm run jest` nutzt `@swc/jest` — swc transpiliert ohne Type-Check, tolerant gegen tsc-Errors.
- `next build` prüft tsc nur über Produktivcode; Test-Files sind nicht im Build-tsc-Scope.
- Es lief kein separater `tsc --noEmit`-Schritt über Tests.

Ergebnis: ein latenter Type-Error war monatelang unsichtbar trotz grüner jest-Suite + grüner Builds + bestandener Cross-Reviews.

**How to apply:**
- Quality-Gate-Liste pro Phase um `npx tsc --noEmit` ergänzen — muss exit 0 sein, deckt Produktiv- UND Test-Files ab.
- In jeden frontend-developer/testing-engineer-Verifikations-Brief aufnehmen: "`npx tsc --noEmit` exit 0 (inkl. Test-Files)".
- Cross-Review-Gate (Architect): `npx tsc --noEmit` selbst laufen lassen, nicht auf Sub-Agent-Report verlassen.
- Test-Type-Pattern: Tests gegen optionale SPI-Methoden müssen die Instanz als das **SPI-Interface** typisieren (`const a: CmsAdapter = new NullCmsAdapter()`), nicht als konkrete Klasse — sonst meckert tsc bei optionalen Methoden, die die Klasse nicht implementiert.
