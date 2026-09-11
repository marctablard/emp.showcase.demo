import { inject } from 'inversify';
import { compareByPosition, walkCategoryTree } from '@/lib/category/category-tree-utils';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import type { EmporixCategory } from '@/platform/integrations/emporix/model/category';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import { buildProductCategoryIdsCriteriaValue } from '@/platform/integrations/emporix/product/buildProductCatalogScopeQ';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CategoryFilterExpansionCacheService } from '../../category/impl/CategoryFilterExpansionCacheService';
import type { CustomerSegmentService } from '../../customer-segment/CustomerSegmentService';
import type { Category } from '../../model/category';
import type { CategoryTreeNode } from '../../model/customer-segment';

/** Upper bound of directly assigned products whose categories are grafted into the forest per call. */
export const PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS = 200;
/** Parallel `assignments/references/{productId}` lookups per batch. */
const PRODUCT_CATEGORY_GRAFT_CONCURRENCY = 8;

/**
 * Category scope of the current customer's segments.
 *
 * Segment assignments come in two kinds:
 * - **Category assigned** to a segment: every product in that category is in scope. The Customer
 *   Segment `category-trees` endpoint returns these categories (`assignedToSegment`) plus their parent
 *   path — never the children — so `allowedCategoryIds` expands assigned nodes to self + descendants
 *   and `assignedCategoryIds` feeds the Emporix `categoryIds:(…)` scope.
 * - **Product assigned** directly to a segment: only that product is in scope; its categories are
 *   *not* returned by `category-trees`. So the forest can still show them (e.g. `Home > Tiles`), the
 *   categories of every directly assigned product are looked up via the Category Service
 *   `assignments/references/{productId}` endpoint and grafted into `roots` with their full ancestor
 *   path, resolved from the site's published navigation trees. Grafted nodes are plain, non-assigned
 *   nodes: they enter `treeCategoryIds` / `allowedCategoryIds` (so `filters[categoryIds]` passes the
 *   AC5 sanitiser) but never `assignedCategoryIds` — otherwise the whole category would be in scope.
 */
export interface SegmentCategoryScope {
  /** Published segment forest (nested `children`) for header / footer / PLP tree. */
  roots: Category[];
  /** Every node of `roots` (category-trees nodes and grafted product-assigned categories with ancestors). */
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

const EMPTY_CATEGORY_SCOPE: SegmentCategoryScope = {
  roots: [],
  treeCategoryIds: [],
  assignedCategoryIds: [],
  allowedCategoryIds: [],
};

/** Trimmed, de-duplicated active segment ids; an empty result means "nothing is in scope". */
function normalizeSegmentIds(segmentIds: readonly string[]): string[] {
  return [...new Set(segmentIds.map((id) => id.trim()).filter(Boolean))];
}

/**
 * `GET /customer-segment/{tenant}/segments/items` `q` on raw response fields (`type`, `segmentId`)
 * — standard Emporix q-param: space-separated fields, `field:(a,b)` for multiple values — so only
 * the assignments of the customer's active segments are fetched. The result is filtered again
 * client-side (`isFromActiveSegment`), so an upstream that ignores the filter cannot widen the scope.
 */
export function buildSegmentItemsQuery(segmentIds: readonly string[]): string {
  return `type:PRODUCT segmentId:(${segmentIds.join(',')})`;
}

/** Root-first ancestor path (inclusive) of every node of the site's published navigation forest. */
type PublicCategoryPathIndex = Map<string, Category[]>;

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

function firstLocalizedName(category: Category): string {
  const name = category.name as Record<string, string> | undefined;
  return name ? (Object.values(name).find((value) => typeof value === 'string') ?? '') : '';
}

/** Sibling order of the segment forest: `position` first, then name. */
function compareSegmentForestSiblings(a: Category, b: Category): number {
  const byPosition = compareByPosition(a, b);
  return byPosition === 0 ? firstLocalizedName(a).localeCompare(firstLocalizedName(b)) : byPosition;
}

/** Plain forest node (same shape as the category-trees mapping): path node only, no subtree, not assigned. */
function toPlainForestNode(publicNode: Category): Category {
  return {
    id: publicNode.id,
    name: publicNode.name,
    description: publicNode.description,
    published: publicNode.published,
    position: publicNode.position,
    children: [],
  };
}

/**
 * Walks one root-first ancestor `path` through the forest, reusing existing nodes and inserting a
 * plain node (siblings re-sorted) where one is missing. Every newly seen id is recorded in
 * `knownIds`, `treeCategoryIds` and `graftedIds`; `roots` and the nodes are mutated in place.
 */
function graftCategoryPath(
  path: readonly Category[],
  roots: Category[],
  knownIds: Set<string>,
  treeCategoryIds: string[],
  graftedIds: string[],
): void {
  let siblings = roots;
  for (const publicNode of path) {
    let node = siblings.find((candidate) => candidate.id === publicNode.id);
    if (!node) {
      node = toPlainForestNode(publicNode);
      siblings.push(node);
      siblings.sort(compareSegmentForestSiblings);
      if (!knownIds.has(node.id)) {
        knownIds.add(node.id);
        treeCategoryIds.push(node.id);
        graftedIds.push(node.id);
      }
    }
    if (!Array.isArray(node.children)) {
      node.children = [];
    }
    siblings = node.children as Category[];
  }
}

/**
 * Scope provider for customer-segment personalisation (COP-4822).
 * Resolves the category forest, the directly assigned product ids and product membership for the
 * current customer; the search engines and the PDP consume these scopes instead of post-filtering.
 * Personalised data: nothing here is cached across requests (only the public category-subtree
 * expansion cache is shared).
 *
 * Every scope takes the active `segmentIds` resolved by `ProductsModeService` (site-bound, `ACTIVE`,
 * inside validity) so that assignments of unrelated segments — inactive, expired or from another
 * site — never widen the scope: the segment items are queried and filtered by `segmentId`, and an
 * empty `segmentIds` list is an empty scope without upstream calls (fail closed).
 * `category-trees` nodes carry no segment id (`isSegmentAssigned` only); that endpoint is bound to
 * the customer token and filtered by the backend to the customer's active segments for the given
 * site, so its forest is used as returned.
 */
@injectable('SegmentFilterService', 'Singleton')
class SegmentFilterService {
  constructor(
    @inject('CustomerSegmentService') private readonly customerSegmentService: CustomerSegmentService,
    @inject('CategoryFilterExpansionCacheService')
    private readonly categoryFilterExpansion: CategoryFilterExpansionCacheService,
    @inject('EmporixProductApi') private readonly productApi: EmporixProductApi,
    @inject('EmporixCategoryApi') private readonly categoryApi: EmporixCategoryApi,
    @inject('CategoryService') private readonly categoryService: CategoryService,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {}

  /**
   * Published segment category forest plus the id sets derived from it, for the active `segmentIds`.
   * Unpublished nodes are dropped together with their subtree. The categories of directly assigned
   * products are grafted into the forest as plain nodes (see `SegmentCategoryScope`); a failure of
   * that best-effort step only affects tree visibility and never the product scope.
   * Empty `segmentIds` → empty scope without upstream calls.
   */
  /**
   * @param productIds Optional already-resolved directly assigned product ids. When provided
   * (array or promise) `getProductScope` is not called again — callers that also need the
   * product scope (Emporix assigned search) share one lookup. Omitted callers keep the
   * best-effort graft path that swallows a failed items lookup.
   */
  async getCategoryScope(
    siteCode: string,
    segmentIds: readonly string[],
    productIds?: readonly string[] | Promise<readonly string[]>,
  ): Promise<SegmentCategoryScope> {
    const activeSegmentIds = normalizeSegmentIds(segmentIds);
    if (activeSegmentIds.length === 0) {
      return { ...EMPTY_CATEGORY_SCOPE };
    }

    const [collected, graftProductIds] = await Promise.all([
      this.collectCategoryScope(siteCode),
      this.resolveGraftProductIds(siteCode, activeSegmentIds, productIds),
    ]);
    const treeCategoryIds = [...collected.treeCategoryIds];
    const roots = await this.graftProductAssignedCategories(
      siteCode,
      graftProductIds,
      collected.roots,
      treeCategoryIds,
    );

    const allowed = new Set(treeCategoryIds);
    if (collected.assignedCategoryIds.length > 0) {
      const expanded = await this.categoryFilterExpansion.expandCategoryIdsForProductSearch(
        collected.assignedCategoryIds,
      );
      expanded.forEach((id) => allowed.add(id));
    }
    return {
      roots,
      treeCategoryIds,
      assignedCategoryIds: collected.assignedCategoryIds,
      allowedCategoryIds: [...allowed],
    };
  }

  /**
   * Distinct ids of the products directly assigned to the customer's **active** segments.
   * Assignments are fetched with `q=type:PRODUCT segmentId:(…)` and additionally kept only when
   * `item.segmentId` is one of `segmentIds`. Empty `segmentIds` → `[]` without an upstream call.
   */
  async getProductScope(siteCode: string, segmentIds: readonly string[]): Promise<SegmentProductScope> {
    const activeSegmentIds = normalizeSegmentIds(segmentIds);
    if (activeSegmentIds.length === 0) {
      return { productIds: [] };
    }

    const active = new Set(activeSegmentIds);
    const items = await this.customerSegmentService.getSegmentItems({
      q: buildSegmentItemsQuery(activeSegmentIds),
      siteCode,
    });
    const productIds = new Set<string>();
    for (const item of items) {
      if (item.type === 'PRODUCT' && item.item?.id && active.has(item.segmentId)) {
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
   * Empty input, empty `segmentIds` or empty scopes → empty set without further upstream calls
   * (fail closed).
   */
  async filterProductIdsInScope(
    productIds: string[],
    siteCode: string,
    segmentIds: readonly string[],
  ): Promise<Set<string>> {
    const candidates = [...new Set(productIds.map((id) => id.trim()).filter(Boolean))];
    const activeSegmentIds = normalizeSegmentIds(segmentIds);
    if (candidates.length === 0 || activeSegmentIds.length === 0) {
      return new Set();
    }

    const [productScope, categoryScope] = await Promise.all([
      this.getProductScope(siteCode, activeSegmentIds),
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

  /**
   * Uses a caller-supplied product-id list when present; otherwise looks the ids up and
   * swallows a failure (tree-only impact).
   */
  private async resolveGraftProductIds(
    siteCode: string,
    segmentIds: readonly string[],
    provided?: readonly string[] | Promise<readonly string[]>,
  ): Promise<string[]> {
    if (provided !== undefined) {
      return [...(await provided)];
    }
    return this.resolveProductIdsForGraft(siteCode, segmentIds);
  }

  /** Directly assigned product ids for the graft; a failed lookup is logged and skipped (tree-only impact). */
  private async resolveProductIdsForGraft(siteCode: string, segmentIds: readonly string[]): Promise<string[]> {
    try {
      return (await this.getProductScope(siteCode, segmentIds)).productIds;
    } catch (error) {
      this.logger.warn(
        { err: error, siteCode },
        'Segment product items lookup failed; product-assigned categories are not grafted into the forest',
      );
      return [];
    }
  }

  /**
   * Grafts the categories of the directly assigned products into `roots` (mutated in place — the
   * forest is freshly built per call) with their full ancestor path from the site's published
   * navigation trees; every new node id is appended to `treeCategoryIds`. Nodes already present are
   * reused, unpublished categories and categories outside the site's published trees are skipped.
   */
  private async graftProductAssignedCategories(
    siteCode: string,
    productIds: string[],
    roots: Category[],
    treeCategoryIds: string[],
  ): Promise<Category[]> {
    if (productIds.length === 0) {
      return roots;
    }
    let lookupIds = productIds;
    if (lookupIds.length > PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS) {
      this.logger.warn(
        { siteCode, productCount: productIds.length, max: PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS },
        'Too many directly assigned products; grafting categories for the first ones only',
      );
      lookupIds = lookupIds.slice(0, PRODUCT_CATEGORY_GRAFT_MAX_PRODUCTS);
    }

    const categoryIds = await this.fetchPublishedCategoryIdsForProducts(siteCode, lookupIds);
    if (categoryIds.size === 0) {
      return roots;
    }

    const pathIndex = await this.buildPublicCategoryPathIndex(siteCode);
    const knownIds = new Set(treeCategoryIds);
    const graftedIds: string[] = [];

    for (const categoryId of categoryIds) {
      const path = pathIndex.get(categoryId);
      if (!path) {
        this.logger.debug(
          { siteCode, categoryId },
          'Product-assigned category not in the published navigation trees; not grafted',
        );
        continue;
      }
      graftCategoryPath(path, roots, knownIds, treeCategoryIds, graftedIds);
    }

    this.logger.debug(
      { siteCode, productCount: lookupIds.length, categoryCount: categoryIds.size, graftedIds },
      'Grafted product-assigned categories into the segment forest',
    );
    return roots;
  }

  /** Distinct published category ids of the given products; one failing product lookup is skipped. */
  private async fetchPublishedCategoryIdsForProducts(siteCode: string, productIds: string[]): Promise<Set<string>> {
    const categoryIds = new Set<string>();
    for (const batch of chunk(productIds, PRODUCT_CATEGORY_GRAFT_CONCURRENCY)) {
      const responses = await Promise.all(
        batch.map(async (productId): Promise<EmporixCategory[]> => {
          try {
            return (await this.categoryApi.getCategoriesByReferenceId(productId, true)).items ?? [];
          } catch (error) {
            this.logger.warn(
              { err: error, siteCode, productId },
              'Category lookup for a directly assigned product failed; skipping it in the segment forest',
            );
            return [];
          }
        }),
      );
      for (const items of responses) {
        for (const category of items) {
          if (category?.id && category.published !== false) {
            categoryIds.add(category.id);
          }
        }
      }
    }
    return categoryIds;
  }

  /** Root-first ancestor paths of the site's published navigation forest (`CategoryService` never rejects). */
  private async buildPublicCategoryPathIndex(siteCode: string): Promise<PublicCategoryPathIndex> {
    const publicRoots = await this.categoryService.getNavigationCategoryTrees(siteCode, false);
    const index: PublicCategoryPathIndex = new Map();
    walkCategoryTree(publicRoots, (node, ancestors) => {
      if (!index.has(node.id)) {
        index.set(node.id, [...ancestors, node]);
      }
    });
    return index;
  }
}

export default SegmentFilterService;
