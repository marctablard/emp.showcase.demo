/**
 * Jest stub for `@/components/product/product-tile`.
 *
 * `ProductTile` transitively reaches the live `useL10n` / `useSiteStore`
 * hooks, which require a real `StoreProvider`. The CMS-component tests
 * (recommendations, etc.) do not render product tiles for assertion —
 * they only verify the surrounding carousel UI and hook invocations.
 * Returning a thin stub keeps the render tree alive without requiring
 * the full Zustand provider stack in every CMS test.
 *
 * Tests that specifically need real `ProductTile` behaviour should
 * import the source path directly or override this mapping.
 */
import { type ReactElement, createElement } from 'react';

interface MockProductTileProps {
  product?: { id?: string; name?: string };
}

export const ProductTile = ({ product }: MockProductTileProps): ReactElement => {
  return createElement(
    'div',
    { 'data-testid': 'mock-product-tile', 'data-product-id': product?.id ?? '' },
    product?.name ?? '',
  );
};
