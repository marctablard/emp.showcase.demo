---
name: env-pin-list-extension
description: env-validation.test.ts pinned OPTIONAL_ENV_VARS exakt via toEqual — bei Erweiterung Pin mit-updaten
metadata:
  type: feedback
---

Das showcase-Test-File `src/platform/healthcheck/__tests__/env-validation.test.ts`
enthält einen exakten Listenvergleich:

```ts
expect(allOptionalKeys).toEqual([
  'NEXT_EMPORIX_CLIENT_ID',
  'NEXT_EMPORIX_CLIENT_SECRET',
]);
```

Eine Erweiterung von OPTIONAL_ENV_VARS bricht diesen Test — das ist ein
Drift-Guard, kein Bug.

**Why:** Pin verhindert silent drift zwischen Code und Erwartung. Eine
neue Optional-Var ohne Test-Update wäre unbemerkte Vertragsänderung.

**How to apply:** Bei jeder Erweiterung von OPTIONAL_ENV_VARS in
`src/platform/healthcheck/env-validation.ts` MUSS die Pin-Liste im Test
mit-aktualisiert werden. Das gilt als legitime Test-Modifikation (Pin-
Erweiterung = Vertragsverschärfung, nicht Lockerung).

Analoges Pattern bei `allRequiredKeys` — selbe Disziplin.
