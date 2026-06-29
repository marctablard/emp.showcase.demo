import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type {
  BatteryIncludedFacetCount,
  BatteryIncludedFacetCountRow,
  BatteryIncludedSearchParams,
  BatteryIncludedSearchResponse,
  BatteryIncludedSuggestion,
} from '@/platform/integrations/batteryincluded/model';
import type { BatteryIncludedProduct } from '@/platform/integrations/batteryincluded/model/product';
import type { BatteryIncludedShopApi } from '@/platform/integrations/batteryincluded/shop/BatteryIncludedShopApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { BATTERY_INCLUDED_BREADCRUMB_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type {
  BatteryIncludedFacet,
  BatteryIncludedFacetOption,
  BatteryIncludedTreeFacetOption,
  Filter,
  SearchFilters,
  SearchParams,
  SearchResult,
} from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { BatteryIncludedCategoryTreeService } from '@/platform/services/search/BatteryIncludedCategoryTreeService';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { SiteService } from '@/platform/services/site/SiteService';
import type { CustomerService } from '../../customer/CustomerService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions, SuggestionsMapper } from '../../model/search';
import type { SessionService } from '../../session';
import { BatteryIncludedFacetsQueryBuilder } from './BatteryIncludedFacetsQueryBuilder';
import { isBatteryIncludedSortFacet } from './BatteryIncludedSortContract';
import { resolveBatteryIncludedAvailableSorts, resolveBatteryIncludedSort } from './BatteryIncludedSortResolver';
import type SegmentFilterService from './SegmentFilterService';

const BATTERY_INCLUDED_SELECTION_CONTEXT_KEY = '__batteryIncludedSelection';
// TODO: Replace this with the authoritative BI rating facet field id once a production sample is captured in-repo.
const BATTERY_INCLUDED_RATING_FACET_IDS = new Set(['rating']);

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

  private mapFacetOption(
    facetId: string,
    row: BatteryIncludedFacetCountRow,
    filters?: SearchFilters,
  ): BatteryIncludedFacetOption {
    return {
      id: row.value,
      label: row.data?.displayPath?.trim() || row.value,
      count: row.count,
      active: this.isFilterValueActive(filters, facetId, row.value),
    };
  }

  private mapTreeFacetOption(
    facetId: string,
    row: BatteryIncludedFacetCountRow,
    labelPath: string[],
    idPath: string[],
    filters?: SearchFilters,
  ): BatteryIncludedTreeFacetOption {
    return {
      ...this.mapFacetOption(facetId, row, filters),
      labelPath,
      idPath,
    };
  }

  private splitFacetPath(value?: string): string[] {
    if (!value) {
      return [];
    }

    return value
      .split('>')
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }

  private resolveFacetLabel(facet: BatteryIncludedFacetCount): string {
    const fieldLabel = facet.field_label?.trim();

    return fieldLabel && fieldLabel.length > 0 ? fieldLabel : facet.field_name;
  }

  private getFacetCounts(facet: BatteryIncludedFacetCount): BatteryIncludedFacetCountRow[] {
    return facet.counts ?? [];
  }

  private classifyFacetKind(facet: BatteryIncludedFacetCount): BatteryIncludedFacet['kind'] {
    if (facet.type === 'range') {
      return 'range';
    }

    if (this.isRatingFacet(facet)) {
      return 'rating';
    }

    if (this.isTreeFacet(facet)) {
      return 'tree';
    }

    return 'select';
  }

  private isTreeFacet(facet: BatteryIncludedFacetCount): boolean {
    const counts = this.getFacetCounts(facet);

    if (facet.type !== 'select' || counts.length === 0) {
      return false;
    }

    return counts.every((row) => {
      const labelPath = this.splitFacetPath(row.data?.displayPath?.trim());
      const idPath = this.splitFacetPath(row.data?.idPath?.trim());

      return labelPath.length > 1 && labelPath.length === idPath.length;
    });
  }

  private isRatingFacet(facet: BatteryIncludedFacetCount): boolean {
    if (!BATTERY_INCLUDED_RATING_FACET_IDS.has(facet.field_name)) {
      return false;
    }

    return this.getFacetCounts(facet).every((row) => {
      const rating = Number(row.value);
      return Number.isInteger(rating) && rating >= 1 && rating <= 5;
    });
  }

  private mapRangeFacet(facet: BatteryIncludedFacetCount): Extract<BatteryIncludedFacet, { kind: 'range' }> {
    const counts = this.getFacetCounts(facet);
    const statsMin = facet.stats?.min;
    const statsMax = facet.stats?.max;
    const legacyBounds = counts.reduce<{ min?: string; max?: string }>((accumulator, row) => {
      if (row.value === 'from') {
        accumulator.min = String(row.count);
      }
      if (row.value === 'till') {
        accumulator.max = String(row.count);
      }
      return accumulator;
    }, {});

    return {
      id: facet.field_name,
      label: this.resolveFacetLabel(facet),
      kind: 'range',
      min: statsMin !== undefined ? String(statsMin) : legacyBounds.min,
      max: statsMax !== undefined ? String(statsMax) : legacyBounds.max,
    };
  }

  private mapRatingLabel(value: string): string {
    const rating = Number(value);
    if (!Number.isInteger(rating)) {
      return value;
    }

    return `${rating} star${rating === 1 ? '' : 's'} & up`;
  }

  private mapBatteryIncludedFacet(facet: BatteryIncludedFacetCount, filters?: SearchFilters): BatteryIncludedFacet {
    const kind = this.classifyFacetKind(facet);
    const label = this.resolveFacetLabel(facet);
    const counts = this.getFacetCounts(facet);

    if (kind === 'range') {
      return this.mapRangeFacet(facet);
    }

    if (kind === 'tree') {
      return {
        id: facet.field_name,
        label,
        kind,
        options: counts.map((row) => {
          const labelPath = this.splitFacetPath(row.data?.displayPath?.trim());
          const idPath = this.splitFacetPath(row.data?.idPath?.trim());
          return this.mapTreeFacetOption(facet.field_name, row, labelPath, idPath, filters);
        }),
      };
    }

    if (kind === 'rating') {
      return {
        id: facet.field_name,
        label,
        kind,
        options: counts.map((row) => ({
          ...this.mapFacetOption(facet.field_name, row, filters),
          label: this.mapRatingLabel(row.value),
        })),
      };
    }

    return {
      id: facet.field_name,
      label,
      kind,
      options: counts.map((row) => this.mapFacetOption(facet.field_name, row, filters)),
    };
  }

  private toLegacyFilter(facet: BatteryIncludedFacet): Filter {
    if (facet.kind === 'range') {
      return {
        id: facet.id,
        name: facet.label,
        labelIsPlainText: true,
        values: [
          ...(facet.min ? [{ id: facet.min, name: facet.min, active: false }] : []),
          ...(facet.max ? [{ id: facet.max, name: facet.max, active: false }] : []),
        ],
      };
    }

    return {
      id: facet.id,
      name: facet.label,
      labelIsPlainText: true,
      values: facet.options.map((option) => ({
        id: option.id,
        name: option.label,
        count: option.count,
        active: option.active,
      })),
    };
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

    const requestSort = resolveBatteryIncludedSort(params.sort, resolveBatteryIncludedAvailableSorts());

    const searchResult: BatteryIncludedSearchResponse<BatteryIncludedProduct> = await this.shopApi.browse({
      page: (params.page || 0) + 1, // normalize page
      size: params.size,
      query: params.query,
      sort: requestSort?.upstreamSort,
      variants: 0,
      analyze: 1,
      variables,
      filters: BatteryIncludedFacetsQueryBuilder.build(filters) as
        | NonNullable<BatteryIncludedSearchParams<BatteryIncludedProduct>['filters']>
        | undefined,
    });
    const variantCountByParentId = this.buildVariantCountByParentId(searchResult.hits);

    const availableSorts = resolveBatteryIncludedAvailableSorts(searchResult.facet_counts);
    const batteryIncludedFacets = searchResult.facet_counts
      .filter(
        (facet) =>
          facet.field_name !== 'segmentIds' &&
          facet.field_name !== BATTERY_INCLUDED_BREADCRUMB_FILTER &&
          !isBatteryIncludedSortFacet(facet),
      )
      .map((facet) => this.mapBatteryIncludedFacet(facet, filters));
    const availableFilters = batteryIncludedFacets.map((facet) => this.toLegacyFilter(facet));
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
      availableSorts,
      batteryIncludedFacets,
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
