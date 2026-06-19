import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type {
  BatteryIncludedSearchParams,
  BatteryIncludedSearchResponse,
  BatteryIncludedSuggestion,
} from '@/platform/integrations/batteryincluded/model';
import type { BatteryIncludedProduct } from '@/platform/integrations/batteryincluded/model/product';
import type { BatteryIncludedShopApi } from '@/platform/integrations/batteryincluded/shop/BatteryIncludedShopApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type { Filter, SearchFilters, SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { BatteryIncludedCategoryTreeService } from '@/platform/services/search/BatteryIncludedCategoryTreeService';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { SiteService } from '@/platform/services/site/SiteService';
import type { CustomerService } from '../../customer/CustomerService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions, SuggestionsMapper } from '../../model/search';
import type { SessionService } from '../../session';
import type SegmentFilterService from './SegmentFilterService';

const BATTERY_INCLUDED_SELECTION_CONTEXT_KEY = '__batteryIncludedSelection';

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
  private siteService: SiteService;
  private logger: LoggerService;

  constructor(
    @inject('BatteryIncludedShopApi') shopApi: BatteryIncludedShopApi,
    @inject('BatteryIncludedProductMapper') productMapper: ProductMapper<BatteryIncludedProduct>,
    @inject('SessionService') sessionService: SessionService,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
    @inject('CustomerService') customerService: CustomerService,
    @inject('BatteryIncludedCategoryTreeService') categoryTreeService: BatteryIncludedCategoryTreeService,
    @inject('SiteService') siteService: SiteService,
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
    this.siteService = siteService;
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

  private buildVariantCountByParentId(
    hits: BatteryIncludedSearchResponse<BatteryIncludedProduct>['hits'],
  ): Map<string, number> {
    const variantCountByParentId = new Map<string, number>();

    hits.forEach((hit) => {
      const parentVariantId = hit.document._product?.parentVariantId;
      if (!parentVariantId) {
        return;
      }

      variantCountByParentId.set(parentVariantId, (variantCountByParentId.get(parentVariantId) ?? 0) + 1);
    });

    return variantCountByParentId;
  }

  private attachSelectionContext(
    product: BatteryIncludedProduct,
    siteAware?: string,
    currencyAware?: string,
  ): BatteryIncludedProduct {
    if (!siteAware && !currencyAware) {
      return product;
    }

    return {
      ...product,
      [BATTERY_INCLUDED_SELECTION_CONTEXT_KEY]: {
        ...(siteAware ? { siteAware } : {}),
        ...(currencyAware ? { currencyAware } : {}),
      },
    };
  }

  private attachSuggestionSelectionContext(
    apiResponse: BatteryIncludedSuggestion<BatteryIncludedProduct>[],
    siteAware?: string,
    currencyAware?: string,
  ): BatteryIncludedSuggestion<BatteryIncludedProduct>[] {
    if (!siteAware && !currencyAware) {
      return apiResponse;
    }

    return apiResponse.map((item) => {
      if (item.kind !== 'document') {
        return item;
      }

      return {
        ...item,
        hits: item.hits.map((hit) => ({
          ...hit,
          highlighted: this.attachSelectionContext(hit.highlighted, siteAware, currencyAware),
        })),
      };
    });
  }
  private mapBrowseFilters(
    filters?: SearchFilters,
  ): NonNullable<BatteryIncludedSearchParams<BatteryIncludedProduct>['filters']> | undefined {
    if (!filters) {
      return undefined;
    }

    return Object.fromEntries(
      Object.entries(filters).map(([key, value]) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return [key, value];
        }

        return [
          key,
          Object.fromEntries(
            Object.entries(value).map(([nestedKey, nestedValue]) => [
              nestedKey,
              Array.isArray(nestedValue) ? nestedValue.join(',') : nestedValue,
            ]),
          ),
        ];
      }),
    );
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

    let currentCountry = session?.country;
    const currentCurrency = session?.currency;

    if (resolvedSite && !currentCountry) {
      const siteConfig = await this.siteService.getSite(resolvedSite);
      if (siteConfig?.defaultCountry) {
        currentCountry = siteConfig.defaultCountry;
      }
    }

    const variables = {
      ...(resolvedLocale ? { locale: resolvedLocale } : {}),
      ...(resolvedSite ? { siteAware: resolvedSite } : {}),
      ...(currentCountry ? { countryAware: currentCountry } : {}),
      ...(currentCurrency ? { currencyAware: currentCurrency } : {}),
    };

    const legacyCategoryIds = filters?.categoryIds;
    if (legacyCategoryIds && resolvedSite && resolvedLocale) {
      const snapshot = await this.categoryTreeService.getSnapshot({
        siteCode: resolvedSite,
        locale: resolvedLocale,
        country: currentCountry,
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
      variants: 0,
      variables,
      filters: this.mapBrowseFilters(filters),
    });
    const variantCountByParentId = this.buildVariantCountByParentId(searchResult.hits);

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
      items: searchResult.hits.map((hit) => {
        const product = this.productMapper.mapToService(
          this.attachSelectionContext(hit.document, resolvedSite, currentCurrency),
        );

        if (product.isParentVariant) {
          return {
            ...product,
            variantCount: variantCountByParentId.get(product.id) ?? 0,
          };
        }

        return product;
      }),
      page: searchResult.page - 1,
      pageSize: params.size || 10, // default
      total: searchResult.found,
      availableFilters: availableFilters,
    };
  }

  async getSuggestions(params: SearchParams<Product>): Promise<SearchSuggestions> {
    try {
      let segmentIds: string[] | undefined;
      if (params.customerSegments) {
        const currentCustomer = await this.customerService.getCustomer();
        if (currentCustomer) {
          segmentIds = await this.segmentFilterService.getSegmentIds();
        }
      }
      const session = await this.sessionService.getCurrent();
      const resolvedSite = params.site ?? session?.siteCode;
      let currentCountry = session?.country;
      const resolvedCurrency = params.currency ?? session?.currency;

      if (resolvedSite && !currentCountry) {
        const siteConfig = await this.siteService.getSite(resolvedSite);
        if (siteConfig?.defaultCountry) {
          currentCountry = siteConfig.defaultCountry;
        }
      }

      const apiResponse = await this.shopApi.suggest({
        query: params.query || '',
        variables: {
          ...(params.locale ? { locale: params.locale } : {}),
          ...(resolvedSite ? { siteAware: resolvedSite } : {}),
          ...(currentCountry ? { countryAware: currentCountry } : {}),
          ...(resolvedCurrency ? { currencyAware: resolvedCurrency } : {}),
        },
        ...(segmentIds?.length ? { segmentIds } : {}),
      });

      return this.suggestionsMapper.mapSearchSuggestions(
        this.attachSuggestionSelectionContext(apiResponse, resolvedSite, resolvedCurrency),
      );
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
    const session = await this.sessionService.getCurrent();
    const resolvedSite = _site ?? session?.siteCode;
    const currentCurrency = session?.currency;

    return recommendations
      .slice(0, cap)
      .map((product) =>
        this.productMapper.mapToService(this.attachSelectionContext(product.document, resolvedSite, currentCurrency)),
      );
  }
}

export default BatteryIncludedSearchService;
