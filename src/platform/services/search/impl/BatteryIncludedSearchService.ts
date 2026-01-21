import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedSearchResponse } from '@/platform/integrations/batteryincluded/model';
import { BatteryIncludedProduct } from '@/platform/integrations/batteryincluded/model/product';
import type { BatteryIncludedShopApi } from '@/platform/integrations/batteryincluded/shop/BatteryIncludedShopApi';
import type { Filter, SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions, SuggestionsMapper } from '../../model/search';
import type { SessionService } from '../../session';

/**
 * Implementation of SearchService for BatteryIncluded product data.
 * Maps between BatteryIncluded API product format and internal Product model.
 */
@injectable('SearchService', 'Singleton')
class BatteryIncludedSearchService implements SearchService {
  private shopApi: BatteryIncludedShopApi;
  private productMapper: ProductMapper<BatteryIncludedProduct>;
  private suggestionsMapper: SuggestionsMapper;
  private sessionService: SessionService;

  constructor(
    @inject('BatteryIncludedShopApi') shopApi: BatteryIncludedShopApi,
    @inject('BatteryIncludedProductMapper') productMapper: ProductMapper<BatteryIncludedProduct>,
    @inject('SessionService') sessionService: SessionService,
  ) {
    this.shopApi = shopApi;
    this.productMapper = productMapper;
    // Since our BatteryIncludedProductMapper also implements SuggestionsMapper, we can use it directly
    this.suggestionsMapper = productMapper as unknown as SuggestionsMapper;
    this.sessionService = sessionService;
  }

  async searchProducts(params: SearchParams<Product>): Promise<SearchResult<Product>> {
    const session = await this.sessionService.getCurrent();
    const searchResult: BatteryIncludedSearchResponse<BatteryIncludedProduct> = await this.shopApi.browse({
      page: (params.page || 0) + 1, // normalize page
      size: params.size,
      query: params.query,
      sort: params.sort,
      filters: params.filters,
    });
    const availableFilters = searchResult.facet_counts.map((facet) => {
      const filter: Filter = {
        id: facet.field_name,
        name: facet.field_name, // TODO handle l10n when we have a representative Dataset
        values: facet.counts
          ? facet.counts.map((value) => ({
              id: value.value,
              name: value.value, // TODO l10n...
              count: value.count,
              active: params.filters ? params.filters[facet.field_name] == value.value : false,
            }))
          : [],
      };
      return filter;
    });
    return {
      items: searchResult.hits
        .filter((hit) => hit.document.siteCode === session?.siteCode)
        .map((hit) => this.productMapper.mapToService(hit.document)),
      page: searchResult.page - 1,
      pageSize: params.size || 10, // default
      total: searchResult.found,
      availableFilters: availableFilters,
    };
  }

  async getSuggestions(query: string, locale?: string): Promise<SearchSuggestions> {
    try {
      const apiResponse = await this.shopApi.suggest(query, locale);
      const session = await this.sessionService.getCurrent();
      const filteredResponse = this.suggestionsMapper.filterBySite(apiResponse, session?.siteCode);
      return this.suggestionsMapper.mapSearchSuggestions(filteredResponse);
    } catch (error) {
      console.error('[SearchService] Error getting suggestions:', error);
      return {
        queryCompletions: [],
        products: [],
        categories: [],
      };
    }
  }

  async getHighlights(): Promise<Product[]> {
    const _highlights = await this.shopApi.getHighlights();

    // Extract products from highlights and map them
    return [];

    /*
    TODO need to clarify, since Documentation is lacking details

    return highlights
      .flatMap(highlight => highlight.products || [])
      .map(product => mapper.mapToService(product));
    */
  }

  async getRecommendations(productId: string): Promise<Product[]> {
    const recommendations = await this.shopApi.getRecommendations(productId);

    return recommendations.map((product) => this.productMapper.mapToService(product.document));
  }
}

export default BatteryIncludedSearchService;
