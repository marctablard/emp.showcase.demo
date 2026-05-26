/**
 * Jest stub for `@/components/product/product-tile-skeleton`.
 *
 * The real skeleton imports `ProductTile` transitively (or relies on
 * shared CSS-only primitives). For the carousel tests we only need a
 * placeholder element so the loading branch renders.
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest mocks are CommonJS modules
const React = require('react');

const ProductTileSkeleton = () => React.createElement('div', { 'data-testid': 'mock-product-tile-skeleton' });

module.exports = { ProductTileSkeleton };
