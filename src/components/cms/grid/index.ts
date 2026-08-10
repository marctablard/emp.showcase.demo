// Side-effect import wires the recursive z.lazy reference in the discriminated
// union before any consumer of this barrel reads GridSchema.
import '../component-schema';

export { default } from './grid';
export type { GridProps } from './grid';
export { GridSchema } from './schema';
export type { GridData } from './schema';
