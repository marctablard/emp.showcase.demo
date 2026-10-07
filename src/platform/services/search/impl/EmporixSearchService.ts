import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedBrowseVariables } from '@/platform/integrations/batteryincluded/model';
import type { EmporixPaginatedResponse, EmporixProduct } from '@/platform/integrations/emporix/model';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import {
  buildProductCategoryIdsCriteriaValue,
  buildSegmentScopeCompoundQuery,
} from '@/platform/integrations/emporix/product/buildProductCatalogScopeQ';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SearchParams, SearchResult, SearchSortOption } from '@/platform/services/model/common';
import type { Product, ProductRecommendations } from '@/platform/services/model/product';
import type { PriceFetchOptions } from '@/platform/services/price/PriceService';
import type { ProductFetchOptions, ProductService } from '@/platform/services/product/ProductService';
import type { RecommendationsOptions, SearchService } from '@/platform/services/search/SearchService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions } from '../../model/search';
import type SegmentFilterService from './SegmentFilterService';

/** Very long `id:(…)` lists inflate the request; warn (no truncation) above this many product ids. */
const SEGMENT_PRODUCT_IDS_WARN_THRESHOLD = 200;

/**
 * A search is "scoped" when it carries a root `categoryIds` criteria or a segment
 * `compoundLogicalQuery` fragment (which already contains the category / product scope).
 */
function criteriaIncludesCategoryIds(criteria: Partial<EmporixProduct>): boolean {
  const record = criteria as Record<string, unknown>;
  const isNonEmptyString = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;
  return isNonEmptyString(record.categoryIds) || isNonEmptyString(record.compoundLogicalQuery);
}

function isUnscopedProductSearch(params: SearchParams<Product>): boolean {
  if (params.searchAllProducts === true) {
    return true;
  }
  return process.env.NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER === 'true';
}

/** Normalises the raw `filters.categoryIds` value (string | string[] | empty) to trimmed non-empty ids. */
function normalizeFilterCategoryIds(raw: unknown): string[] {
  if (raw === undefined || raw === null || raw === '') {
    return [];
  }
  const values: unknown[] = Array.isArray(raw) ? raw : [raw];
  return values.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
}

const EMPORIX_AVAILABLE_SORTS: SearchSortOption[] = [
  {
    id: 'name',
    labelKey: 'name',
    directions: ['asc', 'desc'],
    defaultDirection: 'asc',
  },
];

/**
 * Implementation of SearchService for Emporix product data.
 * Maps between Emporix API product format and internal Product model.
 */
@injectable('EmporixSearchService', 'Singleton')
class EmporixSearchService implements SearchService {
  private productApi: EmporixProductApi;
  private productMapper: ProductMapper<EmporixProduct>;
  private sessionService: SessionService;
  private productService: ProductService;
  private segmentFilterService: SegmentFilterService;
  private categoryService: CategoryService;
  private logger: LoggerService;

  constructor(
    @inject('SessionService') sessionService: SessionService,
    @inject('EmporixProductApi') productApi: EmporixProductApi,
    @inject('EmporixProductMapper') productMapper: ProductMapper<EmporixProduct>,
    @inject('ProductService') productService: ProductService,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
    @inject('CategoryService') categoryService: CategoryService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.productApi = productApi;
    this.productMapper = productMapper;
    this.productService = productService;
    this.sessionService = sessionService;
    this.segmentFilterService = segmentFilterService;
    this.categoryService = categoryService;
    this.logger = logger;
  }

  private emptySearchResult(page: number, pageSize: number): SearchResult<Product> {
    return {
      items: [],
      page,
      pageSize,
      total: 0,
      availableFilters: [],
      availableSorts: EMPORIX_AVAILABLE_SORTS,
    };
  }

  private buildPriceOption(siteCode?: string, currency?: string): boolean | PriceFetchOptions {
    if (siteCode) {
      return { siteCode, ...(currency && { currency }) };
    }
    return true;
  }

  /**
   * Resolve the currency for price matching: explicit `params.currency` wins,
   * otherwise fall back to the current session currency so we never price
   * search results against a site's default currency when the shopper has
   * picked another supported currency.
   */
  private async resolveSearchCurrency(explicitCurrency?: string): Promise<string | undefined> {
    if (explicitCurrency) {
      return explicitCurrency;
    }
    try {
      const session = await this.sessionService.getCurrent();
      return session?.currency;
    } catch {
      return undefined;
    }
  }

  private async mapAndEnrichSearchResults(
    items: EmporixProduct[],
    enrichOptions?: ProductFetchOptions,
  ): Promise<Product[]> {
    const withIds = items.filter((item) => !!item.id);

    const products = withIds.map((item) => this.productMapper.mapToService(item));
    return this.productService.addAdditionalData(
      products,
      enrichOptions ?? { prices: true, variants: true, categories: false },
    );
  }

  private async resolveSiteCode(effectiveSite?: string): Promise<string | undefined> {
    if (effectiveSite) {
      return effectiveSite;
    }
    const session = await this.sessionService.getCurrent();
    return session?.siteCode;
  }

  private buildQueryCriteria(query?: string, field: 'name' | 'id' = 'name'): Record<string, string> {
    const trimmedQuery = query?.trim();
    if (!trimmedQuery) {
      return {};
    }

    return { [field]: `~${trimmedQuery}` };
  }

  /**
   * Segment-scoped criteria (COP-4822): the customer's assigned categories (unexpanded — Emporix
   * resolves subcategories) OR directly assigned products, narrowed by the already-sanitised
   * `filters.categoryIds`, as one verbatim `compoundLogicalQuery:(…)` fragment. Replaces the root
   * `categoryIds` scoping; no post-filtering so paging and totals stay correct.
   * Returns `null` (empty result) when `segmentIds` is empty (nothing visible, e.g. after a failed
   * segment lookup), when the site cannot be resolved or when the whole scope is empty — fail closed.
   */
  private async buildSegmentScopedCriteria(
    segmentIds: string[],
    selectedCategoryIds: string[],
    effectiveSite: string | undefined,
    queryCriteria: Record<string, string>,
  ): Promise<Partial<EmporixProduct> | null> {
    if (segmentIds.length === 0) {
      this.logger.debug(
        { site: effectiveSite },
        'Empty segmentIds scope; returning empty results without upstream calls',
      );
      return null;
    }

    const siteCode = await this.resolveSiteCode(effectiveSite);
    if (!siteCode) {
      this.logger.warn({}, 'Segment-scoped search missing site; returning empty results');
      return null;
    }

    const productScopePromise = this.segmentFilterService.getProductScope(siteCode, segmentIds);
    const [categoryScope, productScope] = await Promise.all([
      this.segmentFilterService.getCategoryScope(
        siteCode,
        segmentIds,
        productScopePromise.then((scope) => scope.productIds),
      ),
      productScopePromise,
    ]);
    if (productScope.productIds.length > SEGMENT_PRODUCT_IDS_WARN_THRESHOLD) {
      this.logger.warn(
        { siteCode, productIds: productScope.productIds.length },
        'Segment product scope is very large; the id:(…) list inflates the search request',
      );
    }

    const fragment = buildSegmentScopeCompoundQuery({
      selectedCategoryIds,
      assignedCategoryIds: categoryScope.assignedCategoryIds,
      productIds: productScope.productIds,
    });
    if (!fragment) {
      this.logger.debug({ siteCode }, 'Segment scope is empty; returning empty results');
      return null;
    }

    return { ...queryCriteria, compoundLogicalQuery: fragment } as Partial<EmporixProduct>;
  }

  /**
   * Builds product search `q` criteria: optional name match plus `categoryIds` when scoped.
   * With `params.segmentIds` defined (`[]` included — an empty scope yields no results) the segment
   * scope is applied as a `compoundLogicalQuery` fragment **before and regardless of**
   * `isUnscopedProductSearch` (`searchAllProducts` / `NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER`
   * never bypass it). `segmentIds === undefined` means unscoped (anonymous / unsegmented).
   * Default `/browse` (no `filters.categoryIds`) uses **published navigation root** ids only — same trees as
   * header/footer — so products tied only to unpublished categories are not in scope. User-selected
   * `filters.categoryIds` are passed through unchanged; Emporix resolves subcategories in search.
   */
  private async buildSearchCriteria(
    params: SearchParams<Product>,
    effectiveSite?: string,
    queryCriteria: Record<string, string> = {},
  ): Promise<Partial<EmporixProduct> | null> {
    const filterCategoryIds = normalizeFilterCategoryIds(params.filters?.categoryIds);

    if (params.segmentIds !== undefined) {
      return this.buildSegmentScopedCriteria(params.segmentIds, filterCategoryIds, effectiveSite, queryCriteria);
    }

    // `''` means "no usable category ids" → empty result; `undefined` means unscoped.
    let categoryValue: string | undefined;
    if (filterCategoryIds.length > 0) {
      categoryValue = buildProductCategoryIdsCriteriaValue(filterCategoryIds) ?? '';
    } else if (isUnscopedProductSearch(params)) {
      categoryValue = undefined;
    } else {
      categoryValue = await this.buildNavigationRootCategoryValue(effectiveSite);
    }
    if (categoryValue === '') {
      return null;
    }

    const criteriaRecord: Record<string, string> = {
      ...queryCriteria,
      ...(categoryValue ? { categoryIds: categoryValue } : {}),
    };

    return criteriaRecord as Partial<EmporixProduct>;
  }

  /**
   * `categoryIds` criteria value for the default catalog-scoped search: the **published navigation
   * root** ids of the site. Returns `''` (→ empty result) when the site, the roots or their ids
   * cannot be resolved.
   */
  private async buildNavigationRootCategoryValue(effectiveSite?: string): Promise<string> {
    const siteCode = await this.resolveSiteCode(effectiveSite);
    if (!siteCode) {
      this.logger.warn({}, 'Catalog-scoped search missing site; returning empty results');
      return '';
    }
    const navigationRoots = await this.categoryService.getNavigationCategoryTrees(siteCode, false);
    if (navigationRoots.length === 0) {
      this.logger.warn({ siteCode }, 'Scoped product search: no published navigation category roots');
      return '';
    }
    const rootIds = navigationRoots.map((c) => c.id).filter((id) => typeof id === 'string' && id.trim().length > 0);
    return buildProductCategoryIdsCriteriaValue(rootIds) ?? '';
  }

  async searchProducts(
    params: SearchParams<Product>,
    locale?: string,
    positionalSite?: string,
  ): Promise<SearchResult<Product>> {
    const requestedSize = params.size ?? 12;
    const page = params.page ?? 0;
    const effectiveSite = params.site ?? positionalSite;
    void (params.locale ?? locale);

    const criteria = await this.buildSearchCriteria(params, effectiveSite, this.buildQueryCriteria(params.query));
    if (criteria === null) {
      return this.emptySearchResult(page, requestedSize);
    }
    if (!isUnscopedProductSearch(params) && !criteriaIncludesCategoryIds(criteria)) {
      this.logger.warn({ site: effectiveSite }, 'Refusing product search without categoryIds in criteria');
      return this.emptySearchResult(page, requestedSize);
    }

    let searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: page + 1,
      size: requestedSize,
      criteria,
      sort: params.sort,
      filters: undefined,
    });

    if (params.query && searchResult.items.length === 0) {
      const idCriteria = await this.buildSearchCriteria(
        params,
        effectiveSite,
        this.buildQueryCriteria(params.query, 'id'),
      );
      if (idCriteria !== null) {
        searchResult = await this.productApi.searchProducts({
          page: page + 1,
          size: requestedSize,
          criteria: idCriteria,
          sort: params.sort,
          filters: undefined,
        });
      }
    }

    const effectiveCurrency = await this.resolveSearchCurrency(params.currency);
    const enrichedProducts = await this.mapAndEnrichSearchResults(searchResult.items, {
      prices: this.buildPriceOption(effectiveSite, effectiveCurrency),
      variants: false,
      categories: false,
    });

    return {
      items: enrichedProducts,
      page: searchResult.page - 1,
      pageSize: requestedSize,
      total: searchResult.total,
      availableFilters: [],
      availableSorts: EMPORIX_AVAILABLE_SORTS,
    };
  }

  async getSuggestions(params: SearchParams<Product>): Promise<SearchSuggestions> {
    const criteria = await this.buildSearchCriteria(params, params.site, this.buildQueryCriteria(params.query));
    if (criteria === null) {
      return {
        queryCompletions: [],
        products: [],
        categories: [],
      };
    }
    if (!isUnscopedProductSearch(params) && !criteriaIncludesCategoryIds(criteria)) {
      this.logger.warn({ site: params.site }, 'Refusing search suggestions without categoryIds in criteria');
      return {
        queryCompletions: [],
        products: [],
        categories: [],
      };
    }

    let searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: 1,
      size: 12,
      criteria,
      sort: undefined,
      filters: undefined,
    });

    if (params.query && searchResult.items.length === 0) {
      const idCriteria = await this.buildSearchCriteria(
        params,
        params.site,
        this.buildQueryCriteria(params.query, 'id'),
      );
      if (idCriteria !== null) {
        searchResult = await this.productApi.searchProducts({
          page: 1,
          size: 12,
          criteria: idCriteria,
          sort: undefined,
          filters: undefined,
        });
      }
    }

    const effectiveCurrency = await this.resolveSearchCurrency(params.currency);
    const enrichedProducts = await this.mapAndEnrichSearchResults(searchResult.items, {
      prices: this.buildPriceOption(params.site, effectiveCurrency),
      variants: false,
      categories: false,
    });

    return {
      queryCompletions: [],
      products: enrichedProducts,
      categories: [],
    };
  }

  async getHighlights(_visibility?: BatteryIncludedBrowseVariables): Promise<Product[]> {
    return [];
  }

  /**
   * Emporix has no recommendations engine: this is a stub that always returns empty recommendations, so the
   * `RecommendationsOptions.segmentIds` contract (COP-4822) is honoured trivially with no upstream call.
   */
  async getRecommendations(
    _productId: string,
    _locale?: string,
    _site?: string,
    _limit?: number,
    _visibility?: BatteryIncludedBrowseVariables,
    _options?: RecommendationsOptions,
  ): Promise<ProductRecommendations> {
    return { products: [], crossSell: [], upSell: [] };
  }

  async getCatalogProductById(
    id: string,
    options?: ProductFetchOptions,
    _locale?: string,
    _site?: string,
  ): Promise<Product | undefined> {
    return this.productService.getProductById(id, options);
  }
}

export default EmporixSearchService;
