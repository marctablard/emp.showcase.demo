'use client';

import { Link } from '@/i18n/navigation';

type ArticleProductLinkProps = {
  productId?: string;
};

/**
 * Client island for the article's "View Product" link in the
 * linked-products grid.
 *
 * Marked 'use client' not because Link itself is special, but because
 * this island is the only 'use client' marker on its consumer path: the
 * parent Article is a Server-Component and there is no Client mid-layer
 * between them. The directive here is required to route
 * @/i18n/navigation into a client module subgraph so its load-time
 * createNavigation() factory call (whose default export is 'use client')
 * is legal. Without it, the build crashes at module-load with "Attempted
 * to call the default export of createNavigation.tsx from the server,
 * but it's on the client".
 *
 * Mirrors the legacy fallback: returns null when no productId is
 * supplied, matching the conditional render in the original flat
 * component.
 */
const ArticleProductLink = ({ productId }: ArticleProductLinkProps) => {
  if (!productId) {
    return null;
  }

  return (
    <Link href={`/product/${productId}`} className="text-text-action hover:underline">
      View Product
    </Link>
  );
};

export default ArticleProductLink;
