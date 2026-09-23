/**
 * Cache configuration for URL pattern-based cache directives
 *
 * Each rule defines:
 * - url: A regex pattern to match against the request pathname
 * - cache: Optional cache configuration
 *   - revalidate: Time in seconds for ISR revalidation (overrides default)
 *   - tags: Array of cache tags for on-demand revalidation
 *            Use $1, $2, etc. to reference regex capture groups
 */

export interface CacheRule {
  url: string;
  cache?: {
    revalidate?: number;
    tags?: string[];
  };
}

/**
 * Default cache revalidation time in seconds.
 * Can be overridden by `NEXT_PUBLIC_CACHE_DEFAULT_REVALIDATE`. The
 * `NEXT_PUBLIC_` name is shared with the Emporix integration layer
 * (`src/platform/integrations/emporix/common/cache-defaults.ts`) so a single
 * setting controls the default revalidation window across both layers.
 */
export const DEFAULT_CACHE_REVALIDATE = parseInt(process.env.NEXT_PUBLIC_CACHE_DEFAULT_REVALIDATE || '3600', 10);

/**
 * Cache rules applied in order
 * First matching rule wins
 */
export const cacheRules: CacheRule[] = [
  {
    // revalidate 0 → private, no-store. The PDP is force-dynamic; a public max-age
    // kept the previous document (and its price) after a deploy.
    url: '/product/(.*)',
    cache: {
      revalidate: 0,
      tags: ['product-$1'],
    },
  },
  {
    url: '/api/products/(.*)/price',
    cache: {
      revalidate: 0,
      tags: [],
    },
  },
  {
    url: '/api/products/(.*)',
    cache: {
      revalidate: 0,
      tags: ['product-$1'],
    },
  },
  {
    // Listing cards carry prices. Keep the rule so it can be turned back on.
    // The primary handler is `/api/search` (no extra slash); subpaths still match.
    url: '/api/search(?:/.*)?',
    cache: {
      revalidate: 0,
      tags: ['search'],
    },
  },
];
