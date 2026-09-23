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
import {
  BATTERY_INCLUDED_BREADCRUMB_FILTER,
  BATTERY_INCLUDED_INDEX_ITEM_ID_FILTER,
  BATTERY_INCLUDED_PRODUCT_ID_FILTER,
  BATTERY_INCLUDED_SEGMENT_IDS_FILTER,
} from '@/platform/services/model/category/batteryincluded-category';
import type {
  BatteryIncludedFacet,
  BatteryIncludedFacetOption,
  BatteryIncludedTreeFacetOption,
  Filter,
  SearchFilterValue,
  SearchFilters,
  SearchParams,
  SearchResult,
  SearchSortOption,
} from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';
import type { ProductFetchOptions, ProductService } from '@/platform/services/product/ProductService';
import type { BatteryIncludedCategoryTreeService } from '@/platform/services/search/BatteryIncludedCategoryTreeService';
import type { RecommendationsOptions, SearchService } from '@/platform/services/search/SearchService';
import type { SiteService } from '@/platform/services/site/SiteService';
import type { CatalogPublishedRootCategoryService } from '../../catalog/impl/CatalogPublishedRootCategoryService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions, SuggestionsMapper } from '../../model/search';
import type { SessionService } from '../../session';
import { BatteryIncludedFacetsQueryBuilder } from './BatteryIncludedFacetsQueryBuilder';
import { parseBatteryIncludedSortToken } from './BatteryIncludedSortContract';
import { BATTERY_INCLUDED_DEFAULT_SORTS, resolveBatteryIncludedSort } from './BatteryIncludedSortResolver';
import {
  buildBatteryIncludedVisibilityFilters,
  buildBatteryIncludedVisibilityVariables,
  mergeBatteryIncludedVisibilityFilters,
} from './batteryincluded-visibility';

const BATTERY_INCLUDED_SELECTION_CONTEXT_KEY = '__batteryIncludedSelection';
// TODO: Replace this with the authoritative BI rating facet field id once a production sample is captured in-repo.
const BATTERY_INCLUDED_RATING_FACET_IDS = new Set(['rating']);

function collectLegacyCategoryIds(value: SearchFilterValue): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((id): id is string => typeof id === 'string' && id.trim() !== '').map((id) => id.trim());
}

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
  private categoryTreeService: BatteryIncludedCategoryTreeService;
  private catalogPublishedRootCategoryService: CatalogPublishedRootCategoryService;
  private siteService: SiteService;
  private logger: LoggerService;

  constructor(
    @inject('BatteryIncludedShopApi') shopApi: BatteryIncludedShopApi,
    @inject('BatteryIncludedProductMapper') productMapper: ProductMapper<BatteryIncludedProduct>,
    @inject('SessionService') sessionService: SessionService,
    @inject('ProductService') productService: ProductService,
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

  /**
   * Attach child VARIANT hits already present in this response onto their parent.
   * Avoids a second Product Service fetch so PLP parent tiles can show unique child chips.
   */
  private attachChildVariantsToParents(products: Product[]): Product[] {
    const variantsByParentId = new Map<string, Product[]>();

    products.forEach((product) => {
      if (!product.parentVariantId || product.isParentVariant) {
        return;
      }
      const siblings = variantsByParentId.get(product.parentVariantId) ?? [];
      siblings.push(product);
      variantsByParentId.set(product.parentVariantId, siblings);
    });

    return products.map((product) => {
      if (!product.isParentVariant) {
        return product;
      }
      const variants = variantsByParentId.get(product.id);
      if (!variants?.length) {
        return product;
      }
      return { ...product, variants };
    });
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

  private catalogDocumentMatchesUrlId(
    document: BatteryIncludedProduct,
    mappedProductId: string,
    urlId: string,
  ): boolean {
    const indexedProductId =
      document._product?.id !== undefined && document._product?.id !== null ? String(document._product.id) : undefined;
    return indexedProductId === urlId || mappedProductId === urlId;
  }

  private async browseCatalogProductByIdFilter(
    id: string,
    idFilterField: string,
    publishedRootIds: string[],
    visibilityVariables: ReturnType<typeof buildBatteryIncludedVisibilityVariables>,
    resolvedSite?: string,
    currentCurrency?: string,
    extraFilters?: SearchFilters,
  ): Promise<Product | undefined> {
    const visibilityFilters =
      mergeBatteryIncludedVisibilityFilters(
        BatteryIncludedFacetsQueryBuilder.build({ ...extraFilters, [idFilterField]: id }) as SearchFilters | undefined,
        publishedRootIds,
      ) ?? undefined;

    if (!visibilityFilters) {
      return undefined;
    }

    const searchResult: BatteryIncludedSearchResponse<BatteryIncludedProduct> = await this.shopApi.browse({
      page: 1,
      size: 1,
      variants: 0,
      analyze: 0,
      visibility: {
        variables: visibilityVariables,
        filters: visibilityFilters,
      },
    });

    const matchingProducts: Product[] = [];
    for (const hit of searchResult.hits) {
      const mapped = this.productMapper.mapToService(
        this.attachSelectionContext(hit.document, resolvedSite, currentCurrency),
      );
      if (this.catalogDocumentMatchesUrlId(hit.document, mapped.id, id)) {
        matchingProducts.push(mapped);
      }
    }

    return matchingProducts.length === 1 ? matchingProducts[0] : undefined;
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

  /**
   * `true` when the caller is segment-scoped but the scope is empty (COP-4822 fail closed, e.g. the
   * segment lookup failed): `undefined` means unscoped, `[]` means nothing is visible. Callers must
   * return an empty result without any BI call.
   */
  private isEmptySegmentScope(segmentIds: string[] | undefined): boolean {
    return segmentIds?.length === 0;
  }

  /**
   * Scope BI results to the given segment ids (COP-4822). The array form is serialised by
   * `appendFilters` as repeated `f[_product_siteAware.segmentIds][]` entries; unscoped callers
   * (`segmentIds === undefined`) leave filters untouched. An empty scope never reaches this helper
   * (see `isEmptySegmentScope`), but it is still applied as-is so an empty array can never widen.
   */
  private applyCustomerSegmentFilters(
    filters: SearchFilters | undefined,
    segmentIds?: string[],
  ): SearchFilters | undefined {
    if (segmentIds === undefined) {
      return filters;
    }

    return {
      ...filters,
      [BATTERY_INCLUDED_SEGMENT_IDS_FILTER]: [...segmentIds],
    };
  }

  private async applyLegacyCategoryBreadcrumbFilters(
    filters: SearchFilters | undefined,
    resolvedSite?: string,
    resolvedLocale?: string,
    currentCountry?: string,
  ): Promise<SearchFilters | undefined> {
    const legacyCategoryIds = filters?.categoryIds;
    if (!legacyCategoryIds || !resolvedSite || !resolvedLocale) {
      return filters;
    }

    const ids = collectLegacyCategoryIds(legacyCategoryIds);
    if (ids.length === 0) {
      return filters;
    }

    const snapshot = await this.categoryTreeService.getSnapshot({
      siteCode: resolvedSite,
      locale: resolvedLocale,
      country: currentCountry,
      showUnpublished: false,
    });
    if (!snapshot) {
      return filters;
    }

    const translated = ids
      .map((id) => snapshot.byId[id]?.displayPath ?? snapshot.byId[id]?.facetValue)
      .filter((value): value is string => Boolean(value));
    if (translated.length !== ids.length) {
      return filters;
    }

    const nextFilters: SearchFilters = {
      ...filters,
      [BATTERY_INCLUDED_BREADCRUMB_FILTER]: translated.length === 1 ? translated[0] : translated,
    };
    const { categoryIds: _removedCategoryIds, ...rest } = nextFilters;
    return rest;
  }

  private async resolveFacetTranslator(resolvedLocale?: string): Promise<((key: string) => string) | undefined> {
    if (!resolvedLocale) {
      return undefined;
    }

    try {
      const t = await getTranslations({ locale: resolvedLocale });
      return (key: string) => t(key as never);
    } catch {
      return undefined;
    }
  }

  private mapHitsWithVariantCounts(
    hits: BatteryIncludedSearchResponse<BatteryIncludedProduct>['hits'],
    resolvedSite: string | undefined,
    currentCurrency: string | undefined,
    variantCountByParentId: Map<string, number>,
  ): Product[] {
    return this.attachChildVariantsToParents(
      hits.map((hit) => {
        const product = this.productMapper.mapToService(
          this.attachSelectionContext(hit.document, resolvedSite, currentCurrency),
        );
        if (!product.isParentVariant) {
          return product;
        }
        return {
          ...product,
          variantCount: variantCountByParentId.get(product.id) ?? 0,
        };
      }),
    );
  }

  private async enrichHitsWithTemplateMeta(mappedItems: Product[]): Promise<Product[]> {
    try {
      return await this.productService.addAdditionalData(mappedItems, {
        prices: false,
        variants: false,
        categories: false,
      });
    } catch (error) {
      this.logger.error(
        { err: error },
        'Search hit enrichment failed; returning Battery Included products without template meta',
      );
      return mappedItems;
    }
  }

  async searchProducts(params: SearchParams<Product>, locale?: string, site?: string): Promise<SearchResult<Product>> {
    if (this.isEmptySegmentScope(params.segmentIds)) {
      return this.buildEmptySearchResult(params.size);
    }

    let filters = this.applyCustomerSegmentFilters(params.filters, params.segmentIds);

    const { resolvedLocale, resolvedSite, currentCountry, currentCurrency, visibilityVariables, publishedRootIds } =
      await this.resolveBatteryIncludedContext({
        locale: locale ?? params.locale,
        site: site ?? params.site,
        currency: params.currency,
      });
    if (publishedRootIds.length === 0) {
      return this.buildEmptySearchResult(params.size);
    }

    filters = await this.applyLegacyCategoryBreadcrumbFilters(filters, resolvedSite, resolvedLocale, currentCountry);

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

    const translate = await this.resolveFacetTranslator(resolvedLocale);
    const batteryIncludedFacets = searchResult.facet_counts
      .filter((facet) => facet.field_name !== BATTERY_INCLUDED_SEGMENT_IDS_FILTER)
      .map((facet) => this.mapBatteryIncludedFacet(facet, filters, translate));
    const availableSorts = this.resolveAvailableSorts(batteryIncludedFacets);
    const availableFilters = batteryIncludedFacets
      .filter((facet) => facet.id !== BATTERY_INCLUDED_BREADCRUMB_FILTER)
      .map((facet) => this.toLegacyFilter(facet));
    const mappedItems = this.mapHitsWithVariantCounts(
      searchResult.hits,
      resolvedSite,
      currentCurrency,
      this.buildVariantCountByParentId(searchResult.hits),
    );
    const items = await this.enrichHitsWithTemplateMeta(mappedItems);

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
    if (this.isEmptySegmentScope(params.segmentIds)) {
      return this.buildEmptySuggestions();
    }

    try {
      const segmentIds = params.segmentIds;
      const { resolvedSite, currentCurrency, visibilityVariables, publishedRootIds } =
        await this.resolveBatteryIncludedContext({
          locale: params.locale,
          site: params.site,
          currency: params.currency,
        });

      if (publishedRootIds.length === 0) {
        return this.buildEmptySuggestions();
      }

      const visibilityFilters: BatteryIncludedVisibilityFilters | undefined =
        buildBatteryIncludedVisibilityFilters(publishedRootIds) ?? undefined;

      const apiResponse = await this.shopApi.suggest({
        query: params.query || '',
        visibility: {
          variables: visibilityVariables,
          filters: visibilityFilters,
        },
        ...(segmentIds === undefined ? {} : { segmentIds }),
      });

      return this.suggestionsMapper.mapSearchSuggestions(
        this.attachSuggestionSelectionContext(apiResponse, resolvedSite, currentCurrency),
      );
    } catch (error) {
      this.logger.error({ err: error }, '[SearchService] Error getting suggestions');
      return this.buildEmptySuggestions();
    }
  }

  private buildEmptySuggestions(): SearchSuggestions {
    return {
      queryCompletions: [],
      products: [],
      categories: [],
    };
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
    options?: RecommendationsOptions,
  ): Promise<Product[]> {
    // Empty segment scope: nothing is visible, so recommendations are empty without any BI call (COP-4822).
    if (this.isEmptySegmentScope(options?.segmentIds)) {
      return [];
    }

    const { resolvedSite, currentCurrency, visibilityVariables, publishedRootIds } = _visibility
      ? await this.resolveBatteryIncludedContext({ site: _visibility.siteAware, currency: _visibility.currencyAware })
      : await this.resolveBatteryIncludedContext({
          locale: _locale,
          site: _site,
        });

    if (publishedRootIds.length === 0) {
      return [];
    }

    // The BI `/recommendations` endpoint takes the same `f[...]` visibility filters as `/browse`, so the
    // segment scope is applied natively as `f[_product_siteAware.segmentIds][]` (COP-4822).
    const visibilityFilters: BatteryIncludedVisibilityFilters | undefined = this.applyCustomerSegmentFilters(
      buildBatteryIncludedVisibilityFilters(publishedRootIds) ?? undefined,
      options?.segmentIds,
    );

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

  async getCatalogProductById(
    id: string,
    options?: ProductFetchOptions,
    locale?: string,
    site?: string,
  ): Promise<Product | undefined> {
    // Empty segment scope: nothing is visible, so the PDP lookup is a miss without any BI call (COP-4822).
    if (this.isEmptySegmentScope(options?.segmentIds)) {
      return undefined;
    }

    // COP-4822 AC4: Emporix membership is the source of truth (category assignment, direct
    // segment items, and product.customerSegmentIds). The BI `_product_siteAware.segmentIds`
    // field is not a reliable PDP gate — a direct URL must 404 when the product is outside
    // the customer's segments.
    if (options?.segmentIds !== undefined) {
      const inScope = await this.productService.isInSegmentScope(id, {
        segmentIds: options.segmentIds,
        siteCode: options.siteCode ?? site,
      });
      if (!inScope) {
        return undefined;
      }
    }

    const session = await this.sessionService.getCurrent();
    const { resolvedSite, currentCurrency, visibilityVariables, publishedRootIds } =
      await this.resolveBatteryIncludedContext({
        locale: locale ?? session?.language,
        site: site ?? session?.siteCode,
      });

    if (publishedRootIds.length === 0) {
      return undefined;
    }

    const mapped =
      (await this.browseCatalogProductByIdFilter(
        id,
        BATTERY_INCLUDED_PRODUCT_ID_FILTER,
        publishedRootIds,
        visibilityVariables,
        resolvedSite,
        currentCurrency,
      )) ??
      (await this.browseCatalogProductByIdFilter(
        id,
        BATTERY_INCLUDED_INDEX_ITEM_ID_FILTER,
        publishedRootIds,
        visibilityVariables,
        resolvedSite,
        currentCurrency,
      ));

    if (!mapped) {
      return undefined;
    }

    const includePrices = options?.prices ?? false;
    const catalogIdentitySeed =
      includePrices === false
        ? {
            ...mapped,
            price: undefined,
            availability: undefined,
          }
        : mapped;

    const [enriched] = await this.productService.addAdditionalData([catalogIdentitySeed], {
      prices: false,
      variants: false,
      categories: false,
      ...options,
    });

    return enriched;
  }
}

export default BatteryIncludedSearchService;
