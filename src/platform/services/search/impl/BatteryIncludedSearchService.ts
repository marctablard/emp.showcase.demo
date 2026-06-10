import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedSearchResponse } from '@/platform/integrations/batteryincluded/model';
import type { BatteryIncludedProduct } from '@/platform/integrations/batteryincluded/model/product';
import type { BatteryIncludedShopApi } from '@/platform/integrations/batteryincluded/shop/BatteryIncludedShopApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type { Filter, SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { BatteryIncludedCategoryTreeService } from '@/platform/services/search/BatteryIncludedCategoryTreeService';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { CustomerService } from '../../customer/CustomerService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions, SuggestionsMapper } from '../../model/search';
import type { SessionService } from '../../session';
import type SegmentFilterService from './SegmentFilterService';

/**
 * Implementation of SearchService for BatteryIncluded product data.
 * Maps between BatteryIncluded API product format and internal Product model.
 */
@injectable('BatteryIncludedSearchService', 'Singleton')
class BatteryIncludedSearchService implements SearchService {
  private shopApi: BatteryIncludedShopApi;
  private productMapper: ProductMapper<BatteryIncludedProduct>;
  private suggestionsMapper: SuggestionsMapper;
  private sessionService: SessionService;
  private segmentFilterService: SegmentFilterService;
  private customerService: CustomerService;
  private categoryTreeService: BatteryIncludedCategoryTreeService;
  private logger: LoggerService;

  constructor(
    @inject('BatteryIncludedShopApi') shopApi: BatteryIncludedShopApi,
    @inject('BatteryIncludedProductMapper') productMapper: ProductMapper<BatteryIncludedProduct>,
    @inject('SessionService') sessionService: SessionService,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
    @inject('CustomerService') customerService: CustomerService,
    @inject('BatteryIncludedCategoryTreeService') categoryTreeService: BatteryIncludedCategoryTreeService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.shopApi = shopApi;
    this.productMapper = productMapper;
    // Since our BatteryIncludedProductMapper also implements SuggestionsMapper, we can use it directly
    this.suggestionsMapper = productMapper as unknown as SuggestionsMapper;
    this.sessionService = sessionService;
    this.segmentFilterService = segmentFilterService;
    this.customerService = customerService;
    this.categoryTreeService = categoryTreeService;
    this.logger = logger;
  }

  private isFilterValueActive(
    filters: SearchParams<Product>['filters'],
    facetId: string,
    candidateValue: string,
  ): boolean {
    const applied = filters?.[facetId];
    if (applied === undefined) {
      return false;
    }
    if (Array.isArray(applied)) {
      return applied.includes(candidateValue);
    }
    return applied === candidateValue;
  }

  async searchProducts(params: SearchParams<Product>, locale?: string, site?: string): Promise<SearchResult<Product>> {
    // Add filter with segmentIds if customer is logged in and has segments assigned.
    let filters = params.filters;
    if (params.customerSegments) {
      const currentCustomer = await this.customerService.getCustomer();
      if (currentCustomer) {
        const segmentIds = await this.segmentFilterService.getSegmentIds();
        if (segmentIds.length > 0) {
          filters = {
            ...filters,
            segmentIds: segmentIds.join(','),
          };
        }
      }
    }

    const session = await this.sessionService.getCurrent();
    const resolvedLocale = locale ?? params.locale;
    const resolvedSite = site ?? params.site ?? session?.siteCode;
    const variables = {
      ...(resolvedLocale ? { locale: resolvedLocale } : {}),
      ...(resolvedSite ? { siteAware: resolvedSite } : {}),
      ...(session?.country ? { countryAware: session.country } : {}),
    };

    const legacyCategoryIds = filters?.categoryIds;
    if (legacyCategoryIds && resolvedSite && resolvedLocale) {
      const snapshot = await this.categoryTreeService.getSnapshot({
        siteCode: resolvedSite,
        locale: resolvedLocale,
        country: session?.country,
        showUnpublished: false,
      });
      if (snapshot) {
        const ids = Array.isArray(legacyCategoryIds) ? legacyCategoryIds : [legacyCategoryIds];
        const translated = ids
          .map((id) => snapshot.byId[String(id).trim()]?.facetValue)
          .filter((value): value is string => Boolean(value));
        if (translated.length === ids.length) {
          filters = {
            ...filters,
            [BATTERY_INCLUDED_BREADCRUMB_FILTER]: translated.length === 1 ? translated[0] : translated,
          };
          const { categoryIds: _removedCategoryIds, ...rest } = filters;
          filters = rest;
        }
      }
    }

    const searchResult: BatteryIncludedSearchResponse<BatteryIncludedProduct> = await this.shopApi.browse({
      page: (params.page || 0) + 1, // normalize page
      size: params.size,
      query: params.query,
      sort: params.sort,
      variables,
      filters: filters,
    });

    const availableFilters = searchResult.facet_counts
      .filter((facet) => facet.field_name !== 'segmentIds' && facet.field_name !== BATTERY_INCLUDED_BREADCRUMB_FILTER)
      .map((facet) => {
        const filter: Filter = {
          id: facet.field_name,
          name: facet.field_name, // TODO handle l10n when we have a representative Dataset
          values: facet.counts
            ? facet.counts.map((value) => ({
                id: value.value,
                name: value.value, // TODO l10n...
                count: value.count,
                active: this.isFilterValueActive(filters, facet.field_name, value.value),
              }))
            : [],
        };
        return filter;
      });
    return {
      items: searchResult.hits.map((hit) => this.productMapper.mapToService(hit.document)),
      page: searchResult.page - 1,
      pageSize: params.size || 10, // default
      total: searchResult.found,
      availableFilters: availableFilters,
    };
  }

  async getSuggestions(params: SearchParams<Product>): Promise<SearchSuggestions> {
    try {
      let segmentIds;
      if (params.customerSegments) {
        const currentCustomer = await this.customerService.getCustomer();
        if (currentCustomer) {
          segmentIds = await this.segmentFilterService.getSegmentIds();
        }
      }
      const apiResponse = await this.shopApi.suggest(params.query || '', params.locale, segmentIds?.join(','));
      if (!params.site) {
        const session = await this.sessionService.getCurrent();
        params.site = session?.siteCode;
      }
      return this.suggestionsMapper.mapSearchSuggestions(apiResponse);
    } catch (error) {
      this.logger.error({ err: error }, '[SearchService] Error getting suggestions');
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

  async getRecommendations(productId: string, _locale?: string, _site?: string, limit?: number): Promise<Product[]> {
    const recommendations = await this.shopApi.getRecommendations(productId);
    const cap = limit ?? 12;

    return recommendations.slice(0, cap).map((product) => this.productMapper.mapToService(product.document));
  }
}

export default BatteryIncludedSearchService;
