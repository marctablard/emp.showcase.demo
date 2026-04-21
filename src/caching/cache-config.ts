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
    url: '/product/(.*)',
    cache: {
      revalidate: 3600,
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
      revalidate: 3600,
      tags: ['product-$1'],
    },
  },
  {
    url: '/api/search/(.*)',
    cache: {
      revalidate: 1800,
      tags: ['search'],
    },
  },
];
