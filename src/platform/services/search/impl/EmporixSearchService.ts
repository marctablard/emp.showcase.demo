import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixPaginatedResponse, EmporixProduct } from '@/platform/integrations/emporix/model';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import { buildProductCategoryIdsCriteriaValue } from '@/platform/integrations/emporix/product/buildProductCatalogScopeQ';
import type { CategoryService } from '@/platform/services/category/CategoryService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { PriceFetchOptions } from '@/platform/services/price/PriceService';
import type { ProductFetchOptions, ProductService } from '@/platform/services/product/ProductService';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions } from '../../model/search';
import type SegmentFilterService from './SegmentFilterService';

function criteriaIncludesCategoryIds(criteria: Partial<EmporixProduct>): boolean {
  const v = (criteria as Record<string, unknown>).categoryIds;
  return typeof v === 'string' && v.trim().length > 0;
}

function isUnscopedProductSearch(params: SearchParams<Product>): boolean {
  if (params.searchAllProducts === true) {
    return true;
  }
  return process.env.NEXT_PUBLIC_SEARCH_OMIT_CATALOG_CATALOG_FILTER === 'true';
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
    };
  }

  private buildPriceOption(siteCode?: string, currency?: string): boolean | PriceFetchOptions {
    if (siteCode) {
      return { siteCode, ...(currency && { currency }) };
    }
    return true;
  }

  private async mapAndEnrichSearchResults(
    items: EmporixProduct[],
    enrichOptions?: ProductFetchOptions,
  ): Promise<Product[]> {
    const withIds = items.filter((item) => !!item.id);
    const filteredItems = (await this.segmentFilterService.filterByCustomerSegments(withIds)) as EmporixProduct[];

    const products = filteredItems.map((item) => this.productMapper.mapToService(item));
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

  /**
   * Builds product search `q` criteria: optional name match plus `categoryIds` when scoped.
   * Default `/browse` (no `filters.categoryIds`) uses **published navigation root** ids only — same trees as
   * header/footer — so products tied only to unpublished categories are not in scope. User-selected
   * `filters.categoryIds` are passed through unchanged; Emporix resolves subcategories in search.
   */
  private async buildSearchCriteria(
    params: SearchParams<Product>,
    effectiveSite?: string,
  ): Promise<Partial<EmporixProduct> | null> {
    const filterCategoryRaw = params.filters?.categoryIds;
    const filterCategoryIds =
      filterCategoryRaw === undefined || filterCategoryRaw === null || filterCategoryRaw === ''
        ? []
        : (Array.isArray(filterCategoryRaw) ? filterCategoryRaw : [filterCategoryRaw]).filter(
            (id): id is string => typeof id === 'string' && id.trim().length > 0,
          );

    let categoryValue: string | undefined;
    if (filterCategoryIds.length > 0) {
      categoryValue = buildProductCategoryIdsCriteriaValue(filterCategoryIds);
      if (!categoryValue) {
        return null;
      }
    } else if (isUnscopedProductSearch(params)) {
      categoryValue = undefined;
    } else {
      const siteCode = await this.resolveSiteCode(effectiveSite);
      if (!siteCode) {
        this.logger.warn({}, 'Catalog-scoped search missing site; returning empty results');
        return null;
      }
      const navigationRoots = await this.categoryService.getNavigationCategoryTrees(siteCode, false);
      if (navigationRoots.length === 0) {
        this.logger.warn({ siteCode }, 'Scoped product search: no published navigation category roots');
        return null;
      }
      const rootIds = navigationRoots.map((c) => c.id).filter((id) => typeof id === 'string' && id.trim().length > 0);
      if (rootIds.length === 0) {
        return null;
      }
      categoryValue = buildProductCategoryIdsCriteriaValue(rootIds);
      if (!categoryValue) {
        return null;
      }
    }

    const criteriaRecord: Record<string, string> = {
      ...(params.query ? { name: '~' + params.query } : {}),
      ...(categoryValue ? { categoryIds: categoryValue } : {}),
    };

    return criteriaRecord as Partial<EmporixProduct>;
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

    const criteria = await this.buildSearchCriteria(params, effectiveSite);
    if (criteria === null) {
      return this.emptySearchResult(page, requestedSize);
    }
    if (!isUnscopedProductSearch(params) && !criteriaIncludesCategoryIds(criteria)) {
      this.logger.warn({ site: effectiveSite }, 'Refusing product search without categoryIds in criteria');
      return this.emptySearchResult(page, requestedSize);
    }

    const searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: page + 1,
      size: requestedSize,
      criteria,
      sort: params.sort,
      filters: undefined,
    });

    const enrichedProducts = await this.mapAndEnrichSearchResults(searchResult.items, {
      prices: this.buildPriceOption(effectiveSite, params.currency),
      variants: false,
      categories: false,
    });

    return {
      items: enrichedProducts,
      page: searchResult.page - 1,
      pageSize: requestedSize,
      total: searchResult.total,
      availableFilters: [],
    };
  }

  async getSuggestions(params: SearchParams<Product>): Promise<SearchSuggestions> {
    const criteria = await this.buildSearchCriteria(params, params.site);
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

    const searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: 1,
      size: 12,
      criteria,
      sort: undefined,
      filters: undefined,
    });

    const enrichedProducts = await this.mapAndEnrichSearchResults(searchResult.items, {
      prices: this.buildPriceOption(params.site, params.currency),
      variants: false,
      categories: false,
    });

    return {
      queryCompletions: [],
      products: enrichedProducts,
      categories: [],
    };
  }

  async getHighlights(): Promise<Product[]> {
    return [];
  }

  async getRecommendations(_productId: string, _locale?: string, _site?: string, _limit?: number): Promise<Product[]> {
    return [];
  }
}

export default EmporixSearchService;
