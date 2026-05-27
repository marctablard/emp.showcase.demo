// Side-effect import wires the recursive z.lazy reference in the discriminated
// union before any consumer of this barrel reads ColumnsSchema.
import '../component-schema';

export { default } from './columns';
export type { ColumnsProps } from './columns';
export { ColumnsSchema } from './schema';
export type { ColumnsData } from './schema';
