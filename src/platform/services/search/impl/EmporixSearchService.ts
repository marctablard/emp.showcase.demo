import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixCatalogApi } from '@/platform/integrations/emporix/catalog/EmporixCatalogApi';
import type { EmporixCategoryApi } from '@/platform/integrations/emporix/category/EmporixCategoryApi';
import { EmporixPaginatedResponse, EmporixProduct } from '@/platform/integrations/emporix/model';
import type { EmporixProductApi } from '@/platform/integrations/emporix/product/EmporixProductApi';
import type { SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions } from '../../model/search';
import type SegmentFilterService from './SegmentFilterService';

/**
 * Implementation of SearchService for Emporix product data.
 * Maps between Emporix API product format and internal Product model.
 */
@injectable('SearchService', 'Singleton')
class EmporixSearchService implements SearchService {
  private productApi: EmporixProductApi;
  private productMapper: ProductMapper<EmporixProduct>;
  private catalogApi: EmporixCatalogApi;
  private sessionService: SessionService;
  private categoryApi: EmporixCategoryApi;
  private productService: ProductService;
  private segmentFilterService: SegmentFilterService;

  constructor(
    @inject('SessionService') sessionService: SessionService,
    @inject('EmporixProductApi') productApi: EmporixProductApi,
    @inject('EmporixProductMapper') productMapper: ProductMapper<EmporixProduct>,
    @inject('EmporixCatalogApi') catalogApi: EmporixCatalogApi,
    @inject('EmporixCategoryApi') categoryApi: EmporixCategoryApi,
    @inject('ProductService') productService: ProductService,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
  ) {
    this.productApi = productApi;
    this.productMapper = productMapper;
    this.catalogApi = catalogApi;
    this.categoryApi = categoryApi;
    this.productService = productService;
    this.sessionService = sessionService;
    this.segmentFilterService = segmentFilterService;
  }

  async searchProducts(params: SearchParams<Product>): Promise<SearchResult<Product>> {
    const productIds = await this.gatherProductIdsFromCatalogs();

    const searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: (params.page || 0) + 1, // normalize page
      size: params.size,
      criteria: {
        ...(params.query && { name: '~' + params.query }),
        id: productIds.length > 0 ? `(${productIds.join(' OR ')})` : undefined,
      },
      sort: undefined,
      filters: undefined,
    });

    const filteredItems = (await this.segmentFilterService.filterByCustomerSegments(
      searchResult.items.filter((item) => !!item.id),
    )) as EmporixProduct[];

    const products = filteredItems.map((item) => this.productMapper.mapToService(item));
    const enrichedProducts = await this.productService.addAdditionalData(products, {
      prices: true,
      variants: true,
      categories: false,
    });
    return {
      items: enrichedProducts,
      page: searchResult.page - 1, // normalize page
      pageSize: searchResult.size,
      total: searchResult.total,
      availableFilters: [],
    };
  }

  async getSuggestions(query: string, _locale?: string): Promise<SearchSuggestions> {
    const productIds = await this.gatherProductIdsFromCatalogs();
    const searchResult: EmporixPaginatedResponse<EmporixProduct> = await this.productApi.searchProducts({
      page: 1,
      size: 10,
      criteria: {
        name: '~' + query,
        id: productIds.length > 0 ? `(${productIds.join(' OR ')})` : undefined,
      },
      sort: undefined,
      filters: undefined,
    });
    const filteredItems = (await this.segmentFilterService.filterByCustomerSegments(
      searchResult.items.filter((item) => !!item.id),
    )) as EmporixProduct[];

    const products = filteredItems.map((item) => this.productMapper.mapToService(item));
    const enrichedProducts = await this.productService.addAdditionalData(products, {
      prices: true,
      variants: true,
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
  private async gatherProductIdsFromCatalogs(): Promise<string[]> {
    const session = await this.sessionService.getCurrent();
    if (!session) {
      throw new Error('No session found');
    }

    const catalogs = await this.catalogApi.getCatalogs({
      page: 1,
      size: 100,
      criteria: {
        publishedSite: session.siteCode,
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
            console.warn(`Failed to get assignments for category ${categoryId}:`, error);
          }
        }
      }
    }

    return Array.from(allProductIds);
  }
}

export default EmporixSearchService;
