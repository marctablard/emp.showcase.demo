import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import { buildProductCategoryIdsCriteriaValue } from '@/platform/integrations/emporix/product/buildProductCatalogScopeQ';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CategoryFilterExpansionCacheService } from '../../category/impl/CategoryFilterExpansionCacheService';
import type { CustomerSegmentService } from '../../customer-segment/CustomerSegmentService';
import type { Category } from '../../model/category';
import type { CategoryTreeNode } from '../../model/customer-segment';

/**
 * Category scope of the current customer's segments (Customer Segment `category-trees` endpoint).
 * The endpoint returns the assigned categories plus their parent path — never the children of an
 * assigned category — so `allowedCategoryIds` expands assigned nodes to self + descendants.
 */
export interface SegmentCategoryScope {
  /** Published segment forest (nested `children`) for header / footer / PLP tree. */
  roots: Category[];
  /** Every node of `roots`. */
  treeCategoryIds: string[];
  /** Nodes flagged as assigned to a segment → Emporix `categoryIds:(…)` scope (passed unexpanded). */
  assignedCategoryIds: string[];
  /** `treeCategoryIds` ∪ self+descendants of `assignedCategoryIds` → accepted by the AC5 filter sanitiser. */
  allowedCategoryIds: string[];
}

/** Product scope of the current customer's segments (directly assigned product ids). */
export interface SegmentProductScope {
  productIds: string[];
}

type CollectedCategoryScope = Omit<SegmentCategoryScope, 'allowedCategoryIds'>;

/**
 * Scope provider for customer-segment personalisation (COP-4822).
 * Resolves the category forest, the directly assigned product ids and product membership for the
 * current customer; the search engines and the PDP consume these scopes instead of post-filtering.
 * Personalised data: nothing here is cached across requests (only the public category-subtree
 * expansion cache is shared).
 */
@injectable('SegmentFilterService', 'Singleton')
class SegmentFilterService {
  constructor(
    @inject('CustomerSegmentService') private readonly customerSegmentService: CustomerSegmentService,
    @inject('CategoryFilterExpansionCacheService')
    private readonly categoryFilterExpansion: CategoryFilterExpansionCacheService,
    @inject('EmporixProductApi') private readonly productApi: EmporixProductApi,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  /**
   * Published segment category forest plus the id sets derived from it.
   * Unpublished nodes are dropped together with their subtree.
   */
  async getCategoryScope(siteCode: string): Promise<SegmentCategoryScope> {
    const collected = await this.collectCategoryScope(siteCode);
    const allowed = new Set(collected.treeCategoryIds);
    if (collected.assignedCategoryIds.length > 0) {
      const expanded = await this.categoryFilterExpansion.expandCategoryIdsForProductSearch(
        collected.assignedCategoryIds,
      );
      expanded.forEach((id) => allowed.add(id));
    }
    return { ...collected, allowedCategoryIds: [...allowed] };
  }

  /** Distinct ids of the products directly assigned to the customer's segments. */
  async getProductScope(siteCode: string): Promise<SegmentProductScope> {
    const items = await this.customerSegmentService.getSegmentItems({ q: 'type:PRODUCT', siteCode });
    const productIds = new Set<string>();
    for (const item of items) {
      if (item.type === 'PRODUCT' && item.item?.id) {
        productIds.add(item.item.id);
      }
    }
    return { productIds: [...productIds] };
  }

  /**
   * Engine-agnostic membership check (Emporix PDP, variants on both engines).
   * An id is in scope when it is directly assigned, or when one Product Service search
   * `q=id:(remaining) categoryIds:(assignedCategoryIds)` returns it (Emporix resolves subcategories
   * of `categoryIds` inside the search, so assigned ids are passed unexpanded).
   * Empty input or empty scopes → empty set without further upstream calls (fail closed).
   */
  async filterProductIdsInScope(productIds: string[], siteCode: string): Promise<Set<string>> {
    const candidates = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
    if (candidates.length === 0) {
      return new Set();
    }

    const [productScope, categoryScope] = await Promise.all([
      this.getProductScope(siteCode),
      this.collectCategoryScope(siteCode),
    ]);

    const directlyAssigned = new Set(productScope.productIds);
    const inScope = new Set(candidates.filter((id) => directlyAssigned.has(id)));
    const remaining = candidates.filter((id) => !inScope.has(id));
    const categoryIdsValue = buildProductCategoryIdsCriteriaValue(categoryScope.assignedCategoryIds);

    if (remaining.length === 0 || !categoryIdsValue) {
      return inScope;
    }

    const response = await this.productApi.searchProducts({
      page: 0,
      size: remaining.length,
      criteria: { id: `(${remaining.join(',')})`, categoryIds: categoryIdsValue },
    });
    const remainingSet = new Set(remaining);
    for (const product of response.items ?? []) {
      if (product.id && remainingSet.has(product.id)) {
        inScope.add(product.id);
      }
    }

    this.logger.debug(
      { siteCode, candidates: candidates.length, inScope: inScope.size },
      'Resolved segment scope membership for product ids',
    );
    return inScope;
  }

  private async collectCategoryScope(siteCode: string): Promise<CollectedCategoryScope> {
    const trees = await this.customerSegmentService.getCategoryTrees({ siteCode });
    const treeCategoryIds: string[] = [];
    const assignedCategoryIds: string[] = [];

    const toCategory = (node: CategoryTreeNode): Category | undefined => {
      if (node.published === false) {
        return undefined;
      }
      treeCategoryIds.push(node.id);
      if (node.assignedToSegment) {
        assignedCategoryIds.push(node.id);
      }
      const children = (node.subcategories ?? [])
        .map(toCategory)
        .filter((child): child is Category => child !== undefined);
      return {
        id: node.id,
        name: node.name,
        description: node.description,
        published: node.published,
        position: node.position,
        children,
      };
    };

    const roots = trees.map(toCategory).filter((root): root is Category => root !== undefined);
    return { roots, treeCategoryIds, assignedCategoryIds };
  }
}

export default SegmentFilterService;
