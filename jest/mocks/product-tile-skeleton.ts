/**
 * Jest stub for `@/components/product/product-tile-skeleton`.
 *
 * The real skeleton imports `ProductTile` transitively (or relies on
 * shared CSS-only primitives). For the carousel tests we only need a
 * placeholder element so the loading branch renders.
 */
import { type ReactElement, createElement } from 'react';

export const ProductTileSkeleton = (): ReactElement =>
  createElement('div', { 'data-testid': 'mock-product-tile-skeleton' });
