---
name: feedback-show323-di-generate-needed-before-jest
description: SHOW-323-Worktree: ohne npm run generate sind 5 Library/Platform-Tests rot durch fehlende src/platform/{server,ssr}.ts; gehört vor jede Baseline-Messung.
metadata:
  type: feedback
---

Im SHOW-323-Worktree sind `src/platform/server.ts` und `src/platform/ssr.ts` (DI-Container-Generated-Files) gitignored, also nicht im frischen Checkout vorhanden. Ohne sie crashen 5 bestehende Tests:

- `src/app/api/session/route.test.ts`
- `src/app/api/session/currency/route.test.ts`
- `src/app/api/quote/route.test.ts`
- `src/platform/services/request-context/impl/NextRequestContextServiceServer.test.ts`
- `src/platform/integrations/emporix/common/EmporixTokenManagerServer.test.ts`

Sie alle mocken `@/platform/server` und scheitern an `moduleNameMapper`-Resolution, wenn die generierte Datei fehlt.

**Why:** Beim Vor-Slice-0-Aufschlag in SHOW-323 sah die Baseline so aus, als wären 5 Tests prä-existing rot — sie waren aber nur durch fehlendes `npm run generate` rot. Sobald die DI-Container generiert waren, 72 Suites / 698 Tests grün. Das hätte einen ganzen Falschen-Regressions-Alarm getriggert, wenn ich vorschnell mit der Diff-Anbringung losgelegt hätte.

**How to apply:** Bei jeder neuen Phase (B–G) oder jedem frischen Worktree-Setup: `npm run generate` ist Teil des Baseline-Setups, vor jeder Baseline-Test-Messung. Auch bei DI-relevanten Code-Änderungen (neue `@injectable`-Klassen, ENV-getriebene Bindings) immer `npm run generate` vor `npm run jest`/`npm run build`. Plan-Doku Risiko #2 (Plan v3) deckt das ab; hier nur die konkrete Symptomatik festhalten.

Verbunden mit [[feedback-di-container-module-graph-split]] (Container-Module-Graph), [[feedback-show323-phase-a-env-required-for-verification]] (Env-Setup).
