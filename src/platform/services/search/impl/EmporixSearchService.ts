import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCatalogApi } from '@/platform/integrations/emporix/catalog/EmporixCatalogApi';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import { EmporixPaginatedResponse, EmporixProduct } from '@/platform/integrations/emporix/model';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions, ProductService } from '@/platform/services/product/ProductService';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions } from '../../model/search';
import type SegmentFilterService from './SegmentFilterService';

/**
 * Implementation of SearchService for Emporix product data.
 * Maps between Emporix API product format and internal Product model.
 */
@injectable('EmporixSearchService', 'Singleton')
class EmporixSearchService implements SearchService {
  private productApi: EmporixProductApi;
  private productMapper: ProductMapper<EmporixProduct>;
  private catalogApi: EmporixCatalogApi;
  private sessionService: SessionService;
  private categoryApi: EmporixCategoryApi;
  private productService: ProductService;
  private segmentFilterService: SegmentFilterService;
  private logger: LoggerService;

  constructor(
    @inject('SessionService') sessionService: SessionService,
    @inject('EmporixProductApi') productApi: EmporixProductApi,
    @inject('EmporixProductMapper') productMapper: ProductMapper<EmporixProduct>,
    @inject('EmporixCatalogApi') catalogApi: EmporixCatalogApi,
    @inject('EmporixCategoryApi') categoryApi: EmporixCategoryApi,
    @inject('ProductService') productService: ProductService,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.productApi = productApi;
    this.productMapper = productMapper;
    this.catalogApi = catalogApi;
    this.categoryApi = categoryApi;
    this.productService = productService;
    this.sessionService = sessionService;
    this.segmentFilterService = segmentFilterService;
    this.logger = logger;
  }

  private async filterMapAndEnrichProducts(
    items: EmporixProduct[],
    site?: string,
    enrichOptions?: ProductFetchOptions,
  ) {
    const beforeFiltering = items.length;

    // TODO : this should be cached somehow,
    // using cache() will only do it per request
    const productIds = await this.gatherProductIdsFromCatalogs(site);
    const productIdSet = new Set(productIds);
    const itemsByCatalog = items
      .filter((item) => !!item.id)
      .filter((item) => productIdSet.size === 0 || productIdSet.has(item.id as string));

    const filteredItems = (await this.segmentFilterService.filterByCustomerSegments(
      itemsByCatalog,
    )) as EmporixProduct[];

    const products = filteredItems.map((item) => this.productMapper.mapToService(item));
    const enrichedProducts = await this.productService.addAdditionalData(
      products,
      enrichOptions ?? { prices: true, variants: true, categories: false },
    );

    return {
      enrichedProducts,
      beforeFiltering,
      filteredCount: filteredItems.length,
    };
  }

  async searchProducts(params: SearchParams<Product>): Promise<SearchResult<Product>> {
    const requestedSize = params.size ?? 16;
    const searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: (params.page || 0) + 1, // normalize page
      size: requestedSize,
      criteria: {
        ...(params.query && { name: '~' + params.query }),
      },
      sort: undefined,
      filters: undefined,
    });

    const { enrichedProducts, beforeFiltering, filteredCount } = await this.filterMapAndEnrichProducts(
      searchResult.items,
      params.site,
      { prices: true, variants: false, categories: false },
    );
    return {
      items: enrichedProducts,
      page: searchResult.page - 1, // normalize page
      pageSize: requestedSize,
      total: searchResult.total - (beforeFiltering - filteredCount), // ~approximation
      availableFilters: [],
    };
  }

  async getSuggestions(params: SearchParams<Product>): Promise<SearchSuggestions> {
    const searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: 1,
      size: 8,
      criteria: {
        name: '~' + params.query,
      },
      sort: undefined,
      filters: undefined,
    });

    const { enrichedProducts } = await this.filterMapAndEnrichProducts(searchResult.items, params.site, {
      prices: true,
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

  async getRecommendations(_productId: string): Promise<Product[]> {
    return [];
  }

  /**
   * Gathers all product IDs from categories across all catalogs for the current session
   * @returns Array of unique product IDs
   */
  private async gatherProductIdsFromCatalogs(site?: string): Promise<string[]> {
    if (!site) {
      const session = await this.sessionService.getCurrent();
      if (!session) {
        throw new Error('No session found');
      }
      site = session.siteCode;
    }

    const catalogs = await this.catalogApi.getCatalogs({
      page: 1,
      size: 100,
      criteria: {
        publishedSite: site,
      },
    });

    if (!catalogs.items.length) {
      throw new Error('No catalog found');
    }

    // Gather product IDs from all categories across all catalogs
    const allProductIds = new Set<string>();
    const allCategoryIdsForCatalog = new Set<string>();

    for (const catalog of catalogs.items) {
      if (catalog.categoryIds && catalog.categoryIds.length > 0) {
        //Get all the subcategories of the root categories
        for (const categoryId of catalog.categoryIds) {
          allCategoryIdsForCatalog.add(categoryId);
          const subcategories = await this.categoryApi.getCategorySubcategories(categoryId);

          if (subcategories?.items && Array.isArray(subcategories.items)) {
            subcategories.items.map((subcategory) => {
              allCategoryIdsForCatalog.add(subcategory.id);
            });
          }
        }

        for (const categoryId of allCategoryIdsForCatalog) {
          try {
            const assignments = await this.categoryApi.getCategoryAssignments(categoryId, {
              page: 1,
              size: 9999,
              criteria: {
                assignmentType: 'PRODUCT',
              },
            });

            // Add all product IDs to our set (using Set to avoid duplicates)
            assignments.items.forEach((assignment) => {
              if (assignment.ref && assignment.ref.id) {
                allProductIds.add(assignment.ref.id);
              }
            });
          } catch (error) {
            // Continue with other categories if one fails
            this.logger.warn(
              {
                err: error,
                categoryId,
              },
              `Failed to get assignments for category ${categoryId}`,
            );
          }
        }
      }
    }

    return Array.from(allProductIds);
  }
}

export default EmporixSearchService;
