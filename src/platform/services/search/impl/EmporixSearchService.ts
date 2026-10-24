import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedBrowseVariables } from '@/platform/integrations/batteryincluded/model';
import type { EmporixAIApi } from '@/platform/integrations/emporix/ai/EmporixAIApi';
import type { EmporixPaginatedResponse, EmporixProduct } from '@/platform/integrations/emporix/model';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import {
  buildProductCategoryIdsCriteriaValue,
  buildSegmentScopeCompoundQuery,
} from '@/platform/integrations/emporix/product/buildProductCatalogScopeQ';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Category } from '@/platform/services/model/category';
import type { SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product, ProductRecommendations } from '@/platform/services/model/product';
import type { PriceFetchOptions } from '@/platform/services/price/PriceService';
import type { ProductFetchOptions, ProductService } from '@/platform/services/product/ProductService';
import type { RecommendationsOptions, SearchService } from '@/platform/services/search/SearchService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions } from '../../model/search';
import type SegmentFilterService from './SegmentFilterService';
import { isCatalogProductId, productIdsFromAgentMessage, shouldTryProductRag } from './emporix-rag-products';
import {
  EMPORIX_AVAILABLE_SORTS,
  EMPORIX_CATALOG_WINDOW,
  type EmporixCatalogFacets,
  type EmporixSelectiveFilters,
  applyPriceWindow,
  applySelectiveCriteria,
  buildCategorySuggestions,
  buildEmporixCatalogFacets,
  buildQueryCompletions,
  hasPriceConstraint,
  hasSelectiveQueryFilters,
  partitionRelatedItems,
  readSelectiveFilters,
  resolveEmporixSort,
  toFallbackRecommendations,
} from './emporix-search-features';

/** Very long `id:(…)` lists inflate the request; warn (no truncation) above this many product ids. */
const SEGMENT_PRODUCT_IDS_WARN_THRESHOLD = 200;

/** The product RAG agent is only a zero-hit fallback, so a slow reply must not hold search open. */
const PRODUCT_RAG_TIMEOUT_MS = 12_000;

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
  private aiApi: EmporixAIApi;

  constructor(
    @inject('SessionService') sessionService: SessionService,
    @inject('EmporixProductApi') productApi: EmporixProductApi,
    @inject('EmporixProductMapper') productMapper: ProductMapper<EmporixProduct>,
    @inject('ProductService') productService: ProductService,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
    @inject('CategoryService') categoryService: CategoryService,
    @inject('LoggerService') logger: LoggerService,
    @inject('EmporixAIApi') aiApi: EmporixAIApi,
  ) {
    this.productApi = productApi;
    this.productMapper = productMapper;
    this.productService = productService;
    this.sessionService = sessionService;
    this.segmentFilterService = segmentFilterService;
    this.categoryService = categoryService;
    this.logger = logger;
    this.aiApi = aiApi;
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

  private asCriteriaRecord(criteria: Partial<EmporixProduct>): Record<string, string> {
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(criteria)) {
      if (typeof value === 'string' && value.length > 0) {
        record[key] = value;
      }
    }
    return record;
  }

  private async enrichSearchHits(items: EmporixProduct[], site?: string, currency?: string): Promise<Product[]> {
    return this.mapAndEnrichSearchResults(items, {
      prices: this.buildPriceOption(site, currency),
      variants: false,
      categories: false,
    });
  }

  private async searchCatalog(
    criteria: Record<string, string>,
    page: number,
    size: number,
    sort?: string,
  ): Promise<EmporixPaginatedResponse<EmporixProduct>> {
    return this.productApi.searchProducts({
      page,
      size,
      criteria: criteria as Partial<EmporixProduct>,
      sort,
      filters: undefined,
    });
  }

  /**
   * Facet options come from the current scope with brand/attribute filters removed, so selecting
   * a brand does not hide the other brands. Counts are included only when that sample is the full match set.
   */
  private async resolveCatalogFacets(
    baseCriteria: Record<string, string>,
    enrichedMatches: Product[],
    upstreamTotal: number,
    selective: EmporixSelectiveFilters,
    locale: string,
    site?: string,
    currency?: string,
  ): Promise<EmporixCatalogFacets> {
    const countsAreComplete = upstreamTotal >= 0 && upstreamTotal <= enrichedMatches.length;
    const sampleCoversWindow =
      !hasSelectiveQueryFilters(selective) &&
      enrichedMatches.length >= Math.min(Math.max(upstreamTotal, 0), EMPORIX_CATALOG_WINDOW);
    if (sampleCoversWindow) {
      return buildEmporixCatalogFacets(enrichedMatches, undefined, locale, countsAreComplete);
    }

    try {
      const sample = await this.searchCatalog(baseCriteria, 1, EMPORIX_CATALOG_WINDOW, 'name:asc');
      const products = await this.enrichSearchHits(sample.items, site, currency);
      const countsAreComplete = sample.total >= 0 && sample.total <= sample.items.length;
      if (!countsAreComplete) {
        this.logger.debug(
          { total: sample.total, sample: sample.items.length },
          'Emporix facet sample is a subset of the match set; option counts are omitted',
        );
      }
      return buildEmporixCatalogFacets(products, undefined, locale, countsAreComplete);
    } catch (error) {
      this.logger.warn(
        { err: error instanceof Error ? error : String(error) },
        'Emporix facet sample failed; returning the page without facet options',
      );
      return { batteryIncludedFacets: [], availableFilters: [] };
    }
  }

  /**
   * Keyword `name:~` / `id:~` does not tolerate misspellings. When that search is empty, ask the
   * frontend agent (product RAG) once, without the shopper chat session, and load the returned ids
   * through the same catalog and segment scope.
   */
  private async resultFromProductRag(
    params: SearchParams<Product>,
    site: string | undefined,
    locale: string,
    currency: string | undefined,
    page: number,
    pageSize: number,
    sort: ReturnType<typeof resolveEmporixSort>,
  ): Promise<SearchResult<Product> | null> {
    const products = await this.loadRagProducts(params, site, locale, currency);
    if (products.length === 0) {
      return null;
    }

    const selective = readSelectiveFilters(params.filters);
    const windowed = hasPriceConstraint(selective, sort)
      ? applyPriceWindow(products, selective, sort.priceDirection, page, pageSize)
      : { items: products.slice(page * pageSize, page * pageSize + pageSize), total: products.length };
    const facets = buildEmporixCatalogFacets(products, undefined, locale, true);

    return {
      items: windowed.items,
      page,
      pageSize,
      total: windowed.total,
      availableFilters: facets.availableFilters,
      availableSorts: EMPORIX_AVAILABLE_SORTS,
      batteryIncludedFacets: facets.batteryIncludedFacets,
    };
  }

  private async loadRagProducts(
    params: SearchParams<Product>,
    site: string | undefined,
    locale: string,
    currency: string | undefined,
  ): Promise<Product[]> {
    const query = params.query?.trim() ?? '';
    if (!shouldTryProductRag(query)) {
      return [];
    }

    const siteCode = await this.resolveSiteCode(site);
    if (!siteCode) {
      return [];
    }

    let ids: string[] = [];
    try {
      ids = await this.productIdsFromRag(query, siteCode, locale, currency);
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error : String(error), query }, 'Product RAG fallback failed');
      return [];
    }

    const safeIds = ids.filter((id) => isCatalogProductId(id));
    if (safeIds.length === 0) {
      return [];
    }

    const baseCriteria = await this.buildSearchCriteria(params, siteCode, { id: `(${safeIds.join(',')})` });
    if (baseCriteria === null) {
      return [];
    }
    if (!isUnscopedProductSearch(params) && !criteriaIncludesCategoryIds(baseCriteria)) {
      return [];
    }

    const criteria = applySelectiveCriteria(this.asCriteriaRecord(baseCriteria), readSelectiveFilters(params.filters));
    const result = await this.searchCatalog(criteria, 1, safeIds.length);
    const enriched = await this.enrichSearchHits(result.items, siteCode, currency);
    const byId = new Map(enriched.map((product) => [product.id, product]));
    const ordered = safeIds.flatMap((id) => {
      const product = byId.get(id);
      return product ? [product] : [];
    });
    if (ordered.length === 0) {
      this.logger.debug({ query }, 'Product RAG fallback returned no catalog products');
      return [];
    }

    this.logger.info({ query, products: ordered.length }, 'Product search used the product RAG fallback');
    return ordered;
  }

  private async productIdsFromRag(
    query: string,
    siteCode: string,
    locale: string,
    currency: string | undefined,
  ): Promise<string[]> {
    const context = {
      siteId: siteCode,
      currency: currency ?? 'EUR',
      language: locale,
    };
    const userMessage = `Find products matching this search, including close spellings: ${query}`;
    const response = await withTimeout(
      this.aiApi.searchCatalogWithProductRag(userMessage, context),
      PRODUCT_RAG_TIMEOUT_MS,
    );
    return productIdsFromAgentMessage(response.message);
  }

  async searchProducts(
    params: SearchParams<Product>,
    locale?: string,
    positionalSite?: string,
  ): Promise<SearchResult<Product>> {
    const requestedSize = params.size ?? 12;
    const page = params.page ?? 0;
    const effectiveSite = params.site ?? positionalSite;
    const resolvedLocale = params.locale ?? locale ?? 'en';
    const sort = resolveEmporixSort(params.sort);
    const selective = readSelectiveFilters(params.filters);

    const baseCriteria = await this.buildSearchCriteria(params, effectiveSite, this.buildQueryCriteria(params.query));
    if (baseCriteria === null) {
      return this.emptySearchResult(page, requestedSize);
    }
    if (!isUnscopedProductSearch(params) && !criteriaIncludesCategoryIds(baseCriteria)) {
      this.logger.warn({ site: effectiveSite }, 'Refusing product search without categoryIds in criteria');
      return this.emptySearchResult(page, requestedSize);
    }

    const criteria = applySelectiveCriteria(this.asCriteriaRecord(baseCriteria), selective);
    const effectiveCurrency = await this.resolveSearchCurrency(params.currency);
    const priceConstrained = hasPriceConstraint(selective, sort);

    if (priceConstrained) {
      const window = await this.searchCatalog(criteria, 1, EMPORIX_CATALOG_WINDOW, sort.productSort);
      if (window.total > EMPORIX_CATALOG_WINDOW) {
        this.logger.warn(
          { total: window.total, window: EMPORIX_CATALOG_WINDOW },
          'Price sort or filter uses a bounded catalog window; totals beyond that window are incomplete',
        );
      }
      if (params.query && window.items.length === 0) {
        const recovered = await this.resultFromProductRag(
          params,
          effectiveSite,
          resolvedLocale,
          effectiveCurrency,
          page,
          requestedSize,
          sort,
        );
        if (recovered) {
          return recovered;
        }
      }

      const enrichedWindow = await this.enrichSearchHits(window.items, effectiveSite, effectiveCurrency);
      const priced = applyPriceWindow(enrichedWindow, selective, sort.priceDirection, page, requestedSize);
      const facets = await this.resolveCatalogFacets(
        this.asCriteriaRecord(baseCriteria),
        enrichedWindow,
        window.total,
        selective,
        resolvedLocale,
        effectiveSite,
        effectiveCurrency,
      );

      return {
        items: priced.items,
        page,
        pageSize: requestedSize,
        total: priced.total,
        availableFilters: facets.availableFilters,
        availableSorts: EMPORIX_AVAILABLE_SORTS,
        batteryIncludedFacets: facets.batteryIncludedFacets,
      };
    }

    let searchResult = await this.searchCatalog(criteria, page + 1, requestedSize, sort.productSort);

    if (params.query && searchResult.items.length === 0) {
      const idBase = await this.buildSearchCriteria(params, effectiveSite, this.buildQueryCriteria(params.query, 'id'));
      if (idBase !== null) {
        searchResult = await this.searchCatalog(
          applySelectiveCriteria(this.asCriteriaRecord(idBase), selective),
          page + 1,
          requestedSize,
          sort.productSort,
        );
      }
    }

    if (params.query && searchResult.items.length === 0) {
      const recovered = await this.resultFromProductRag(
        params,
        effectiveSite,
        resolvedLocale,
        effectiveCurrency,
        page,
        requestedSize,
        sort,
      );
      if (recovered) {
        return recovered;
      }
    }

    const enrichedProducts = await this.enrichSearchHits(searchResult.items, effectiveSite, effectiveCurrency);
    const facets = await this.resolveCatalogFacets(
      this.asCriteriaRecord(baseCriteria),
      enrichedProducts,
      searchResult.total,
      selective,
      resolvedLocale,
      effectiveSite,
      effectiveCurrency,
    );

    return {
      items: enrichedProducts,
      page: searchResult.page - 1,
      pageSize: requestedSize,
      total: searchResult.total,
      availableFilters: facets.availableFilters,
      availableSorts: EMPORIX_AVAILABLE_SORTS,
      batteryIncludedFacets: facets.batteryIncludedFacets,
    };
  }

  private async loadSuggestionCategoryRoots(params: SearchParams<Product>): Promise<Category[]> {
    const siteCode = await this.resolveSiteCode(params.site);
    if (!siteCode) {
      return [];
    }

    if (params.segmentIds === undefined) {
      return this.categoryService.getNavigationCategoryTrees(siteCode, false);
    }

    const scope = await this.segmentFilterService.getCategoryScope(siteCode, params.segmentIds);
    return scope.roots ?? [];
  }

  async getSuggestions(params: SearchParams<Product>): Promise<SearchSuggestions> {
    const locale = params.locale ?? 'en';
    const selective = readSelectiveFilters(params.filters);
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

    const scopedCriteria = applySelectiveCriteria(this.asCriteriaRecord(criteria), selective);
    let searchResult = await this.searchCatalog(scopedCriteria, 1, 12);

    if (params.query && searchResult.items.length === 0) {
      const idCriteria = await this.buildSearchCriteria(
        params,
        params.site,
        this.buildQueryCriteria(params.query, 'id'),
      );
      if (idCriteria !== null) {
        searchResult = await this.searchCatalog(
          applySelectiveCriteria(this.asCriteriaRecord(idCriteria), selective),
          1,
          12,
        );
      }
    }

    const effectiveCurrency = await this.resolveSearchCurrency(params.currency);
    let enrichedProducts = await this.enrichSearchHits(searchResult.items, params.site, effectiveCurrency);
    if (enrichedProducts.length === 0) {
      const recovered = await this.loadRagProducts(params, params.site, locale, effectiveCurrency);
      if (recovered.length > 0) {
        enrichedProducts = recovered;
      }
    }
    let categories: SearchSuggestions['categories'] = [];
    try {
      categories = buildCategorySuggestions(await this.loadSuggestionCategoryRoots(params), params.query, locale);
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error : String(error) }, 'Search suggestion categories failed');
    }

    return {
      queryCompletions: buildQueryCompletions(enrichedProducts, params.query, locale),
      products: enrichedProducts,
      categories,
    };
  }

  async getHighlights(_visibility?: BatteryIncludedBrowseVariables): Promise<Product[]> {
    return [];
  }

  private emptyRecommendations(): ProductRecommendations {
    return { products: [], crossSell: [], upSell: [] };
  }

  /**
   * Recommendations use product `relatedItems` (upsell vs accessory/similar/consumable), scoped like
   * catalog search. An empty segment list returns nothing without an upstream call. When a product has
   * no related items, the same category is used as a fallback.
   */
  async getRecommendations(
    productId: string,
    locale?: string,
    site?: string,
    limit?: number,
    _visibility?: BatteryIncludedBrowseVariables,
    options?: RecommendationsOptions,
  ): Promise<ProductRecommendations> {
    if (options?.segmentIds?.length === 0) {
      return this.emptyRecommendations();
    }

    const source = await this.productService.getProductById(productId, {
      categories: true,
      prices: false,
      variants: false,
      segmentIds: options?.segmentIds,
      siteCode: site,
    });
    if (!source) {
      return this.emptyRecommendations();
    }

    const cap = limit ?? 12;
    const { crossSellIds, upSellIds } = partitionRelatedItems(source.relatedItems);
    const relatedIds = [...crossSellIds, ...upSellIds].filter((id) => id !== productId);
    const relatedProducts = relatedIds.length
      ? await this.searchProductsByIds(relatedIds, site, options?.segmentIds, locale)
      : [];

    if (relatedProducts.length === 0) {
      const categoryId = source.primaryCategory?.id ?? source.categories?.[0]?.id ?? source.categoryIds?.[0];
      if (!categoryId) {
        return this.emptyRecommendations();
      }

      const fallback = await this.searchProducts(
        {
          page: 0,
          size: cap + 1,
          site,
          locale,
          segmentIds: options?.segmentIds,
          filters: { categoryIds: [categoryId] },
        },
        locale,
        site,
      );
      const products = fallback.items.filter((product) => product.id !== productId).slice(0, cap);
      return products.length > 0 ? toFallbackRecommendations(products) : this.emptyRecommendations();
    }

    const byId = new Map(relatedProducts.map((product) => [product.id, product]));
    const crossSell = crossSellIds
      .flatMap((id) => {
        const product = byId.get(id);
        return product ? [product] : [];
      })
      .slice(0, cap);
    const upSell = upSellIds
      .flatMap((id) => {
        const product = byId.get(id);
        return product ? [product] : [];
      })
      .slice(0, cap);

    return {
      products: [...crossSell, ...upSell].slice(0, cap),
      crossSell,
      upSell,
    };
  }

  private async searchProductsByIds(
    ids: string[],
    site: string | undefined,
    segmentIds: string[] | undefined,
    locale: string | undefined,
  ): Promise<Product[]> {
    const safeIds = ids.filter((id) => /^[A-Za-z0-9_.:@/+-]+$/.test(id));
    if (safeIds.length === 0) {
      return [];
    }

    const baseCriteria = await this.buildSearchCriteria(
      { segmentIds, site, locale, searchAllProducts: false },
      site,
      {},
    );
    if (baseCriteria === null) {
      return [];
    }

    const criteria = this.asCriteriaRecord(baseCriteria);
    criteria.id = `(${safeIds.join(',')})`;
    const currency = await this.resolveSearchCurrency(undefined);
    const result = await this.searchCatalog(criteria, 1, safeIds.length);
    return this.enrichSearchHits(result.items, site, currency);
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Product RAG fallback timed out')), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

export default EmporixSearchService;
