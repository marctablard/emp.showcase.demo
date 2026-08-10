/**
 * Page is the recursive container of CMS components: its `body` references
 * the global discriminated union of all CMS schemas, which itself contains
 * PageSchema.
 *
 * Both the schema and its inferred `PageData` type are owned by
 * `component-schema.ts` to keep the recursive cycle inside a single module
 * (the alternative — schema split across two files — requires a runtime
 * proxy to bridge the load-time TDZ, which we avoid here). This file
 * re-exports them so consumers still resolve the schema via the
 * conventional `<name>/schema.ts` path.
 */
export { PageSchema } from '../component-schema';
export type { PageData } from '../component-schema';
