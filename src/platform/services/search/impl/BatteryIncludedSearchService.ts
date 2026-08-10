import { getTranslations } from 'next-intl/server';
import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type {
  BatteryIncludedFacetCount,
  BatteryIncludedFacetCountRow,
  BatteryIncludedSearchResponse,
  BatteryIncludedSuggestion,
} from '@/platform/integrations/batteryincluded/model';
import type { BatteryIncludedVisibilityFilters } from '@/platform/integrations/batteryincluded/model';
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
  SearchSortOption,
} from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { ProductService } from '@/platform/services/product/ProductService';
import type { BatteryIncludedCategoryTreeService } from '@/platform/services/search/BatteryIncludedCategoryTreeService';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { SiteService } from '@/platform/services/site/SiteService';
import type { CatalogPublishedRootCategoryService } from '../../catalog/impl/CatalogPublishedRootCategoryService';
import type { CustomerService } from '../../customer/CustomerService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions, SuggestionsMapper } from '../../model/search';
import type { SessionService } from '../../session';
import { BatteryIncludedFacetsQueryBuilder } from './BatteryIncludedFacetsQueryBuilder';
import { parseBatteryIncludedSortToken } from './BatteryIncludedSortContract';
import { BATTERY_INCLUDED_DEFAULT_SORTS, resolveBatteryIncludedSort } from './BatteryIncludedSortResolver';
import type SegmentFilterService from './SegmentFilterService';
import {
  buildBatteryIncludedVisibilityFilters,
  buildBatteryIncludedVisibilityVariables,
  mergeBatteryIncludedVisibilityFilters,
} from './batteryincluded-visibility';

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
  private readonly productService: ProductService;
  private segmentFilterService: SegmentFilterService;
  private customerService: CustomerService;
  private categoryTreeService: BatteryIncludedCategoryTreeService;
  private catalogPublishedRootCategoryService: CatalogPublishedRootCategoryService;
  private siteService: SiteService;
  private logger: LoggerService;

  constructor(
    @inject('BatteryIncludedShopApi') shopApi: BatteryIncludedShopApi,
    @inject('BatteryIncludedProductMapper') productMapper: ProductMapper<BatteryIncludedProduct>,
    @inject('SessionService') sessionService: SessionService,
    @inject('ProductService') productService: ProductService,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
    @inject('CustomerService') customerService: CustomerService,
    @inject('BatteryIncludedCategoryTreeService') categoryTreeService: BatteryIncludedCategoryTreeService,
    @inject('CatalogPublishedRootCategoryService')
    catalogPublishedRootCategoryService: CatalogPublishedRootCategoryService,
    @inject('SiteService') siteService: SiteService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.shopApi = shopApi;
    this.productMapper = productMapper;
    // Since our BatteryIncludedProductMapper also implements SuggestionsMapper, we can use it directly
    this.suggestionsMapper = productMapper as unknown as SuggestionsMapper;
    this.sessionService = sessionService;
    this.productService = productService;
    this.segmentFilterService = segmentFilterService;
    this.customerService = customerService;
    this.categoryTreeService = categoryTreeService;
    this.catalogPublishedRootCategoryService = catalogPublishedRootCategoryService;
    this.siteService = siteService;
    this.logger = logger;
  }

  private buildEmptySearchResult(pageSize?: number): SearchResult<Product> {
    return {
      items: [],
      page: 0,
      pageSize: pageSize ?? 10,
      total: 0,
      availableFilters: [],
      availableSorts: [],
      batteryIncludedFacets: [],
    };
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

  private async resolveBatteryIncludedContext(params: { locale?: string; site?: string; currency?: string }): Promise<{
    resolvedLocale?: string;
    resolvedSite?: string;
    currentCountry?: string;
    currentCurrency?: string;
    visibilityVariables: ReturnType<typeof buildBatteryIncludedVisibilityVariables>;
    publishedRootIds: string[];
  }> {
    const session = await this.sessionService.getCurrent();
    const resolvedLocale = params.locale;
    const resolvedSite = params.site ?? session?.siteCode;

    let currentCountry = session?.country;
    const currentCurrency = params.currency ?? session?.currency;

    if (resolvedSite && !currentCountry) {
      const siteConfig = await this.siteService.getSite(resolvedSite);
      if (siteConfig?.defaultCountry) {
        currentCountry = siteConfig.defaultCountry;
      }
    }

    const publishedRootIds = resolvedSite
      ? await this.catalogPublishedRootCategoryService.getRootCategoryIdsForSite(resolvedSite)
      : [];

    return {
      resolvedLocale,
      resolvedSite,
      currentCountry,
      currentCurrency,
      publishedRootIds,
      visibilityVariables: buildBatteryIncludedVisibilityVariables({
        locale: resolvedLocale,
        site: resolvedSite,
        country: currentCountry,
        currency: currentCurrency,
      }),
    };
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

  private resolveFacetLabel(facet: BatteryIncludedFacetCount, translate?: (key: string) => string): string {
    const fieldLabel = facet.field_label?.trim();

    if (fieldLabel) {
      if (fieldLabel.startsWith('#')) {
        const key = fieldLabel.slice(1).trim();
        // A bare '#' (optionally followed by whitespace) is a malformed marker with no key.
        if (!key) {
          return facet.field_name;
        }
        if (!translate) {
          return key;
        }
        // translate() may throw (e.g. missing/invalid message key); degrade to the raw key.
        try {
          return translate(key);
        } catch {
          return key;
        }
      }
      return fieldLabel;
    }

    return facet.field_name;
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

  private mapRangeFacet(
    facet: BatteryIncludedFacetCount,
    translate?: (key: string) => string,
  ): Extract<BatteryIncludedFacet, { kind: 'range' }> {
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
      label: this.resolveFacetLabel(facet, translate),
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

  private mapBatteryIncludedFacet(
    facet: BatteryIncludedFacetCount,
    filters?: SearchFilters,
    translate?: (key: string) => string,
  ): BatteryIncludedFacet {
    const kind = this.classifyFacetKind(facet);
    const label = this.resolveFacetLabel(facet, translate);
    const counts = this.getFacetCounts(facet);

    if (kind === 'range') {
      return this.mapRangeFacet(facet, translate);
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

  private resolveAvailableSorts(facets: BatteryIncludedFacet[]): SearchSortOption[] {
    const responseDrivenSorts: SearchSortOption[] = facets
      .filter((facet): facet is Extract<BatteryIncludedFacet, { kind: 'select' }> => facet.kind === 'select')
      .filter((facet) => this.isExplicitResponseDrivenSortFacet(facet))
      .map((facet): SearchSortOption => ({
        id: facet.id,
        label: facet.label,
        directions: ['asc', 'desc'],
        defaultDirection: 'asc',
      }));

    const dedupedSorts = new Map<string, SearchSortOption>();
    [...BATTERY_INCLUDED_DEFAULT_SORTS, ...responseDrivenSorts].forEach((sort) => {
      if (!dedupedSorts.has(sort.id)) {
        dedupedSorts.set(sort.id, sort);
      }
    });

    return [...dedupedSorts.values()];
  }

  private isExplicitResponseDrivenSortFacet(facet: Extract<BatteryIncludedFacet, { kind: 'select' }>): boolean {
    if (facet.options.length === 0) {
      return false;
    }

    const parsedSortTokens = facet.options.map((option) => parseBatteryIncludedSortToken(option.id));
    if (parsedSortTokens.some((token) => token === null)) {
      return false;
    }

    const directions = new Set(parsedSortTokens.map((token) => token!.direction));
    const fieldNames = new Set(parsedSortTokens.map((token) => token!.fieldName));

    return directions.has('asc') && directions.has('desc') && fieldNames.size === 1;
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

    const { resolvedLocale, resolvedSite, currentCountry, currentCurrency, visibilityVariables, publishedRootIds } =
      await this.resolveBatteryIncludedContext({
        locale: locale ?? params.locale,
        site: site ?? params.site,
        currency: params.currency,
      });
    if (publishedRootIds.length === 0) {
      return this.buildEmptySearchResult(params.size);
    }

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
          .map((id) => snapshot.byId[String(id).trim()]?.displayPath ?? snapshot.byId[String(id).trim()]?.facetValue)
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

    const requestSort = resolveBatteryIncludedSort(params.sort);
    const visibilityFilters: BatteryIncludedVisibilityFilters | undefined =
      mergeBatteryIncludedVisibilityFilters(
        BatteryIncludedFacetsQueryBuilder.build(filters) as SearchFilters | undefined,
        publishedRootIds,
      ) ?? undefined;

    if (!visibilityFilters) {
      return this.buildEmptySearchResult(params.size);
    }

    const searchResult: BatteryIncludedSearchResponse<BatteryIncludedProduct> = await this.shopApi.browse({
      page: (params.page || 0) + 1, // normalize page
      size: params.size,
      query: params.query,
      sort: requestSort?.upstreamSort,
      variants: 0,
      analyze: 1,
      visibility: {
        variables: visibilityVariables,
        filters: visibilityFilters,
      },
    });
    const variantCountByParentId = this.buildVariantCountByParentId(searchResult.hits);

    // Resolve a translator for `#`-prefixed localized facet labels. `getTranslations` is only
    // available in a server request context; degrade gracefully elsewhere (e.g. tests) so search
    // never crashes and plain labels are unaffected. Note: keys used via the `#` marker (e.g.
    // `bi.basePrice`) are resolved dynamically and are therefore invisible to `check-translations`.
    let translate: ((key: string) => string) | undefined;
    if (resolvedLocale) {
      try {
        const t = await getTranslations({ locale: resolvedLocale });
        translate = (key: string) => t(key as never);
      } catch {
        translate = undefined;
      }
    }
    const batteryIncludedFacets = searchResult.facet_counts
      .filter((facet) => facet.field_name !== 'segmentIds')
      .map((facet) => this.mapBatteryIncludedFacet(facet, filters, translate));
    const availableSorts = this.resolveAvailableSorts(batteryIncludedFacets);
    const availableFilters = batteryIncludedFacets
      .filter((facet) => facet.id !== BATTERY_INCLUDED_BREADCRUMB_FILTER)
      .map((facet) => this.toLegacyFilter(facet));
    const mappedItems = searchResult.hits.map((hit) => {
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
    });

    // Resolve template attribute labels/types (same path as Emporix search / PDP key specs).
    // Skip prices/variants — BI hits already carry priced display data.
    const items = await this.productService.addAdditionalData(mappedItems, {
      prices: false,
      variants: false,
      categories: false,
    });

    return {
      items,
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
      const { resolvedSite, currentCurrency, visibilityVariables, publishedRootIds } =
        await this.resolveBatteryIncludedContext({
          locale: params.locale,
          site: params.site,
          currency: params.currency,
        });

      if (publishedRootIds.length === 0) {
        return {
          queryCompletions: [],
          products: [],
          categories: [],
        };
      }

      const visibilityFilters: BatteryIncludedVisibilityFilters | undefined =
        buildBatteryIncludedVisibilityFilters(publishedRootIds) ?? undefined;

      const apiResponse = await this.shopApi.suggest({
        query: params.query || '',
        visibility: {
          variables: visibilityVariables,
          filters: visibilityFilters,
        },
        ...(segmentIds?.length ? { segmentIds } : {}),
      });

      return this.suggestionsMapper.mapSearchSuggestions(
        this.attachSuggestionSelectionContext(apiResponse, resolvedSite, currentCurrency),
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

  async getHighlights(_visibility?: ReturnType<typeof buildBatteryIncludedVisibilityVariables>): Promise<Product[]> {
    const { visibilityVariables, publishedRootIds } = _visibility
      ? await this.resolveBatteryIncludedContext({ site: _visibility.siteAware, currency: _visibility.currencyAware })
      : await this.resolveBatteryIncludedContext({});
    if (publishedRootIds.length === 0) {
      return [];
    }

    const visibilityFilters: BatteryIncludedVisibilityFilters | undefined =
      buildBatteryIncludedVisibilityFilters(publishedRootIds) ?? undefined;

    await this.shopApi.getHighlights({
      variables: _visibility ?? visibilityVariables,
      filters: visibilityFilters,
    });

    // Extract products from highlights and map them
    return [];

    /*
    TODO need to clarify, since Documentation is lacking details

    return highlights
      .flatMap(highlight => highlight.products || [])
      .map(product => mapper.mapToService(product));
    */
  }

  async getRecommendations(
    productId: string,
    _locale?: string,
    _site?: string,
    limit?: number,
    _visibility?: ReturnType<typeof buildBatteryIncludedVisibilityVariables>,
  ): Promise<Product[]> {
    const { resolvedSite, currentCurrency, visibilityVariables, publishedRootIds } = _visibility
      ? await this.resolveBatteryIncludedContext({ site: _visibility.siteAware, currency: _visibility.currencyAware })
      : await this.resolveBatteryIncludedContext({
          locale: _locale,
          site: _site,
        });

    if (publishedRootIds.length === 0) {
      return [];
    }

    const visibilityFilters: BatteryIncludedVisibilityFilters | undefined =
      buildBatteryIncludedVisibilityFilters(publishedRootIds) ?? undefined;

    const recommendations = await this.shopApi.getRecommendations(productId, {
      variables: _visibility ?? visibilityVariables,
      filters: visibilityFilters,
    });
    const cap = limit ?? 12;

    return recommendations
      .slice(0, cap)
      .map((product) =>
        this.productMapper.mapToService(this.attachSelectionContext(product.document, resolvedSite, currentCurrency)),
      );
  }
}

export default BatteryIncludedSearchService;
