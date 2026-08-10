---
name: drift-guard-id-consistency
description: Drift-Guard "akzeptiert jeden Wert in CMS_PROVIDER_IDS" enforced nur die Liste-vs-Guard-Synchronisierung — er erwischt NICHT, dass ein DI-Binding für `CmsAdapter:<id>` tatsächlich existiert. Diese Lücke ist bewusst.
metadata:
  type: feedback
---

Drift-Guards, die über eine `as const` Tuple-Liste iterieren und prüfen, dass der Resolver jeden Wert akzeptiert, beweisen NUR: Liste und Type-Guard sind in sync. Sie beweisen NICHT, dass für jeden Eintrag ein lauffähiges `@injectable('CmsAdapter:<id>')` existiert.

**Why:** der Resolver verarbeitet Strings; ob das DI-Binding existiert, ist Concern des Adapter-Erstellers. Bei `CmsProviderResolver.test.ts:91-100` würde ein neuer Eintrag `'sanity'` in `CMS_PROVIDER_IDS` ohne Adapter-Klasse den Drift-Guard grün lassen, aber zur Laufzeit nur `logger.warn` in `instrumentation.ts:42-48` triggern.

**How to apply:** Bei Drift-Guards die Scope explizit dokumentieren: was prüft der Guard, was prüft er NICHT. Bei Bedarf zweistufiger Guard: (1) String-Akzeptanz im Resolver, (2) Integration-Test gegen den fertigen Container, der `c.isBound('CmsAdapter:<id>')` für jeden Eintrag validiert. Slice 1 hat (2) bewusst weggelassen — Phase B+ können das nachziehen, wenn weitere Adapter dazukommen.

Bezug: [[no-direct-instantiation-audit]] zeigt ein ähnliches Source-Audit-Pattern für DI-Invarianten.
