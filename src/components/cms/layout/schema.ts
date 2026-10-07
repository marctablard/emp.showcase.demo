/**
 * Layout is a recursive container of CMS components: its `body` references
 * the global discriminated union, which itself contains LayoutSchema.
 *
 * Both the schema and its inferred `LayoutData` type are owned by
 * `component-schema.ts` to keep the recursive cycle inside a single module
 * (same load-time rationale as `page` / `segment` / `columns`). This file
 * re-exports them so consumers still resolve the schema via the conventional
 * `<name>/schema.ts` path.
 *
 * `LayoutContentSchema` is the refined variant used at the `getLayout`
 * boundary: it enforces that a layout contains exactly ONE `content-slot`
 * (counted transitively through nested containers). It is intentionally NOT
 * a member of the discriminated union — a `superRefine` wraps the object in
 * `ZodEffects`, which `z.discriminatedUnion` cannot accept.
 */
export { LayoutSchema, LayoutContentSchema } from '../component-schema';
export type { LayoutData } from '../component-schema';
