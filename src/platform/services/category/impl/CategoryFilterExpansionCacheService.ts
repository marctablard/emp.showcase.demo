import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import { collectSubtreeIdsFromCategoryTrees } from '@/platform/integrations/emporix/category/collect-subtree-category-ids';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

const DEFAULT_MAX_ENTRIES = 300;

function resolveExpansionCacheTtlMs(): number {
  const raw = process.env.CATEGORY_TREE_EXPANSION_CACHE_TTL_SECONDS;
  if (raw === undefined || raw === '') {
    const fallback = process.env.CATALOG_ROOT_CATEGORY_CACHE_TTL_SECONDS;
    if (fallback === undefined || fallback === '') {
      return 10 * 60 * 1000;
    }
    const sec = parseInt(fallback, 10);
    return Number.isFinite(sec) && sec > 0 ? sec * 1000 : 10 * 60 * 1000;
  }
  const sec = parseInt(raw, 10);
  if (!Number.isFinite(sec) || sec <= 0) {
    return 10 * 60 * 1000;
  }
  return sec * 1000;
}

function resolveMaxEntries(): number {
  const raw = process.env.CATEGORY_TREE_EXPANSION_CACHE_MAX_ENTRIES;
  if (raw === undefined || raw === '') {
    return DEFAULT_MAX_ENTRIES;
  }
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5000) : DEFAULT_MAX_ENTRIES;
}

type CacheEntry = {
  expandedIds: string[];
  expiresAt: number;
};

/**
 * In-process TTL + LRU cache for category filter → expanded subtree ids (Emporix category-trees/search).
 * One cache per Node process; not shared across serverless instances.
 */
@injectable('CategoryFilterExpansionCacheService', 'Singleton')
export class CategoryFilterExpansionCacheService {
  private readonly data = new Map<string, CacheEntry>();
  private readonly lruKeys: string[] = [];
  private readonly ttlMs = resolveExpansionCacheTtlMs();
  private readonly maxEntries = resolveMaxEntries();

  constructor(
    @inject('EmporixCategoryApi') private readonly categoryApi: EmporixCategoryApi,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  /**
   * Expands browse category filter ids to self + descendants (published trees only).
   * On Emporix failure returns the normalized input ids (same as uncached path); does not cache failures.
   */
  async expandCategoryIdsForProductSearch(filterIds: string[]): Promise<string[]> {
    const unique = [...new Set(filterIds.map((id) => id.trim()).filter(Boolean))].sort();
    if (unique.length === 0) {
      return [];
    }

    const key = unique.join('\0');
    const now = Date.now();
    const hit = this.data.get(key);
    if (hit && hit.expiresAt > now) {
      this.touchLru(key);
      return hit.expandedIds;
    }

    try {
      const trees = await this.categoryApi.searchCategoryTreesForCategoryIds(unique);
      let expanded: string[];
      if (trees.length === 0) {
        expanded = unique;
      } else {
        const out = new Set<string>();
        for (const targetId of unique) {
          const subtree = collectSubtreeIdsFromCategoryTrees(trees, targetId);
          if (subtree.length > 0) {
            subtree.forEach((id) => out.add(id));
          } else {
            out.add(targetId);
          }
        }
        expanded = [...out];
      }

      this.setLru(key, { expandedIds: expanded, expiresAt: now + this.ttlMs });
      return expanded;
    } catch (err) {
      this.logger.warn(
        { err, filterIds: unique },
        'Category tree search for product filter expansion failed; using raw category ids',
      );
      return unique;
    }
  }

  private touchLru(key: string): void {
    const i = this.lruKeys.indexOf(key);
    if (i >= 0) {
      this.lruKeys.splice(i, 1);
    }
    this.lruKeys.push(key);
  }

  private setLru(key: string, entry: CacheEntry): void {
    if (!this.data.has(key)) {
      while (this.lruKeys.length >= this.maxEntries) {
        const evict = this.lruKeys.shift();
        if (evict) {
          this.data.delete(evict);
        }
      }
    }
    this.data.set(key, entry);
    this.touchLru(key);
  }
}

export default CategoryFilterExpansionCacheService;
