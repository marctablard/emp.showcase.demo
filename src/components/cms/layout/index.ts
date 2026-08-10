// Side-effect import wires the recursive z.lazy reference in the discriminated
// union before any consumer of this barrel reads LayoutSchema.
import '../component-schema';

export { default } from './layout';
export type { LayoutProps } from './layout';
export { LayoutSchema, LayoutContentSchema } from './schema';
export type { LayoutData } from './schema';
