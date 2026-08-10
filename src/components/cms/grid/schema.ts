/**
 * Grid is a recursive layout container: its `columns` field references the
 * global discriminated union, which itself contains GridSchema.
 *
 * Both the schema and its inferred `GridData` type are owned by
 * `component-schema.ts` to keep the recursive cycle inside a single module.
 * This file re-exports them so consumers still resolve the schema via the
 * conventional `<name>/schema.ts` path.
 */
export { GridSchema } from '../component-schema';
export type { GridData } from '../component-schema';
