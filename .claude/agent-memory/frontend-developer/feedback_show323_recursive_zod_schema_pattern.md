---
name: feedback-show323-recursive-zod-schema-pattern
description: SHOW-323 Slice 2 — Recursive Zod-Schema (Page <-> CMSComponentSchema) gehört zusammen in EIN Modul; Split via Proxy ist ein Trap.
metadata:
  type: feedback
---

`PageSchema` mit `body: z.array(z.lazy(() => CMSComponentSchema))` IN `component-schema.ts` co-located definieren — nicht split über `page/schema.ts` + `component-schema.ts`. Re-export via `page/schema.ts` für Convention-Compliance.

**Why:** Split-Approach scheitert an drei Stellen:
1. ESM-Live-Bindings + `z.discriminatedUnion('type', [PageSchema])` triggert TDZ-`ReferenceError` (PageSchema noch nicht initialisiert, weil page/schema mid-load).
2. Proxy-basierter Workaround (`PageSchema = new Proxy(BaseSchema)` + late-`setRecursive()` via `extend()`) erzeugt `Maximum call stack` weil `extend()` durch den Proxy wieder den Proxy referenziert.
3. `import type`-only auf der Domain-Seite triggert die Side-Effects nicht — Recursion-Wiring läuft nie. Side-Effect-Import (`import '../component-schema'`) in der Barrel funktioniert, ist aber fragil.

Co-Location ist sauber: `z.lazy(() => CMSComponentSchema)` captured lexically die spätere `const`-Binding, evaluiert at parse-time. TS-strict braucht aber explizite `ZodObject<{...}>`-Annotation auf `PageSchema`, weil sonst `implicitly has type any... referenced directly or indirectly in its own initializer` schreit (TS7022) — Jest/swc toleriert, `next build` (tsc) nicht.

**How to apply:** Bei recursive Zod schemas (Page-Body, Columns-Body, Grid-Children in Slice 3) entweder im selben Modul wie das Union co-located oder Proxy-Pattern als Last-Resort markieren. Plus explizite `z.ZodObject<{...}>`-Annotation für TS-strict-Build.

Beispiel siehe `src/components/cms/component-schema.ts` (Slice 2 Commit `1b979378`, refined in `aead7ca4`).
