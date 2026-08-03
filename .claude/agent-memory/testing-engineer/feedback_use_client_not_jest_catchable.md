---
name: use-client-not-jest-catchable
description: 'use client'/RSC-Boundary-Fehler sind nicht von Jest fangbar (jsdom No-op); nur Next-Build + verify:client-chunks greift — im Review nicht als Test-Loch werten
metadata:
  type: feedback
---

`'use client'`-Fehlplatzierung (fehlende Directive auf Modul mit client-only API, oder client-only Subgraph-Trigger wie `@/i18n/navigation` Link → `createNavigation`) ist **strukturell nicht von Jest fangbar**.

**Why:** In jsdom ist `'use client'` ein No-op — die RSC server/client-Boundary wird nur vom Next-Build + `scripts/verify-client-chunks.mjs` erzwungen. Slice-3 hatte genau diesen Fall: Pre-Audit-Grep übersah den Module-Subgraph-Trigger, Jest war grün, Build crashte. Die korrekte Safety-Net-Schicht ist der Build, nicht der Test.

**How to apply:** Im Cross-Review eine fehlende `'use client'`-Directive NICHT als Test-Coverage-Finding werten — kein Test kann/soll das duplizieren. Stattdessen prüfen: (1) sind Parents server (kein `'use client'`), Inseln client? per `head -1`-Grep, (2) ist `npm run verify:client-chunks` + Build exit 0? Das ist der Nachweis. Dafür gilt: Pattern-A-Inseln transitiv im Parent-Test mounten lassen (un-mockt) gibt einen Render-Sanity-Check — aber die Boundary-Korrektheit selbst kommt vom Build.

Verwandt: Inseln, die der Parent-Test ausmockt (z.B. recommendations-carousel) verlieren auch den Render-Sanity-Check → dann dediziertes Insel-Test-File fordern.
