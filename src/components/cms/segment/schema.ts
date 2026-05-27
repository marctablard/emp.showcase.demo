/**
 * Segment is a recursive container of CMS components: its `content_blocks`
 * reference the global discriminated union, which itself contains
 * SegmentSchema.
 *
 * Both the schema and its inferred `SegmentData` type are owned by
 * `component-schema.ts` to keep the recursive cycle inside a single module.
 * This file re-exports them so consumers still resolve the schema via the
 * conventional `<name>/schema.ts` path.
 */
export { SegmentSchema } from '../component-schema';
export type { SegmentData } from '../component-schema';
