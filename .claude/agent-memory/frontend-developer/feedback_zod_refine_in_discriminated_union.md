---
name: feedback-zod-refine-in-discriminated-union
description: Zod `discriminatedUnion` requires `ZodObject` members — applying `.refine()` to a member turns it into `ZodEffects` and breaks the union. Split into a raw `ZodObject` (registered in the union) and a refined public schema (used by direct callers).
metadata:
  type: feedback
---

When a CMS container schema needs both:
1. Membership in the global `CMSComponentSchema = z.discriminatedUnion('type', […])` so the recursive renderer/parser can dispatch on it, AND
2. A `.refine()` invariant on the top-level shape (e.g. "Layout body must contain exactly one transitive `content-slot`"),

you cannot wrap a single schema in `.refine()` and add it to the union. `discriminatedUnion` requires a `ZodObject`; `.refine()` returns `ZodEffects`. Membership is rejected with a type error.

**Pattern used in SHOW-323 Slice 5 (`src/components/cms/layout/schema.ts`):**

```ts
// Raw ZodObject — added to the discriminated union.
export const LayoutObjectSchema = z.object({ id, type: z.literal('layout'), body });

// Public refined schema — used by adapters / fixture parsers / tests.
export const LayoutSchema = LayoutObjectSchema.refine(
  (layout) => countContentSlots(layout.body) === 1,
  { message: '...' },
);
```

The component-map and `CMSComponentSchema.parse` use `LayoutObjectSchema`. The fixture parser and test callers use `LayoutSchema` (refined).

**Why:** The drift-guard test (`component-map.test.ts`) introspects `.shape.type._def.value` on each map entry. `.refine()` strips `.shape`. Registering the refined schema breaks the drift-guard. Registering the raw `ZodObject` keeps both the drift-guard and the union dispatch happy.

**How to apply:**
- Any new CMS container with `.refine()` invariants: split into `XSchema` (refined, public) and `XObjectSchema` (raw, registered in the union).
- Document the split rationale in the schema-file JSDoc so future readers know not to "consolidate" them.
- Drift-guard expects the raw schema; the discriminator literal is on the raw `.shape.type`.
