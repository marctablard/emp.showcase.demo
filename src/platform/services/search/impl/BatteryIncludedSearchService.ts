import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedRecommendationHit } from '@/platform/integrations/batteryincluded/model';
import type { BatteryIncludedProduct } from '@/platform/integrations/batteryincluded/model/product';
import type { BatteryIncludedShopApi } from '@/platform/integrations/batteryincluded/shop/BatteryIncludedShopApi';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Filter, LocalizedString, SearchParams, SearchResult } from '@/platform/services/model/common';
import type { Product, ProductRecommendations } from '@/platform/services/model/product';
import type { SearchService } from '@/platform/services/search/SearchService';
import type { CustomerService } from '../../customer/CustomerService';
import type { ProductMapper } from '../../model/product/ProductMapper';
import type { SearchSuggestions, SuggestionsMapper } from '../../model/search';
import type { ProductService } from '../../product/ProductService';
import type SegmentFilterService from './SegmentFilterService';

const CROSS_SELL_RECOMMENDATION_TYPES = new Set(['together', 'also']);
const UP_SELL_RECOMMENDATION_TYPES = new Set(['related']);

/**
 * Implementation of SearchService for BatteryIncluded product data.
 * Maps between BatteryIncluded API product format and internal Product model.
 */
@injectable('BatteryIncludedSearchService', 'Singleton')
class BatteryIncludedSearchService implements SearchService {
  private shopApi: BatteryIncludedShopApi;
  private productMapper: ProductMapper<BatteryIncludedProduct>;
  private suggestionsMapper: SuggestionsMapper;
  private segmentFilterService: SegmentFilterService;
  private customerService: CustomerService;
  private productService: ProductService;
  private logger: LoggerService;

  constructor(
    @inject('BatteryIncludedShopApi') shopApi: BatteryIncludedShopApi,
    @inject('BatteryIncludedProductMapper') productMapper: ProductMapper<BatteryIncludedProduct>,
    @inject('SegmentFilterService') segmentFilterService: SegmentFilterService,
    @inject('CustomerService') customerService: CustomerService,
    @inject('ProductService') productService: ProductService,
    @inject('LoggerService') logger: LoggerService,
  ) {
    this.shopApi = shopApi;
    this.productMapper = productMapper;
    // Since our BatteryIncludedProductMapper also implements SuggestionsMapper, we can use it directly
    this.suggestionsMapper = productMapper as unknown as SuggestionsMapper;
    this.segmentFilterService = segmentFilterService;
    this.customerService = customerService;
    this.productService = productService;
    this.logger = logger;
  }

  async searchProducts(
    params: SearchParams<Product>,
    _locale?: string,
    _site?: string,
  ): Promise<SearchResult<Product>> {
    // Add filter with segmentIds if customer is logged in and has segments assigned.
    let filters = params.filters ? { ...params.filters } : undefined;
    if (filters?.siteCode) {
      delete filters.siteCode;
    }
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

    // NOTE: Do not add `siteCode` as a search filter. The BatteryIncluded collection
    // schema has no `siteCode` facet field, so sending it makes the browse query fail
    // with "Could not find a facet field named `siteCode` in the schema" (HTTP 500).
    const searchResult = await this.shopApi.browse({
      page: (params.page || 0) + 1, // normalize page
      size: params.size,
      query: params.query,
      sort: params.sort,
      filters,
    });

    const availableFilters = searchResult.facet_counts
      .filter((facet) => facet.field_name !== 'segmentIds')
      .map((facet) => {
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
    const products = searchResult.hits.map((hit) => this.productMapper.mapToService(hit.document));
    const enrichedProducts = await this.productService.addAdditionalData(products, { prices: true });

    return {
      items: enrichedProducts,
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
      const suggestions = this.suggestionsMapper.mapSearchSuggestions(apiResponse);
      if (suggestions.products.length === 0) {
        return suggestions;
      }

      const enrichedProducts = await this.productService.addAdditionalData(suggestions.products, { prices: true });
      return {
        ...suggestions,
        products: enrichedProducts,
      };
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

  async getRecommendations(
    productId: string,
    locale?: string,
    _site?: string,
    limit?: number,
  ): Promise<ProductRecommendations> {
    const cap = limit ?? 12;
    const recommendations = await this.shopApi.getRecommendations(productId);
    const mapped = this.mapRecommendationHits(recommendations, cap);

    if (mapped.products.length > 0) {
      return mapped;
    }

    return this.getFallbackRecommendations(productId, cap, locale);
  }

  private mapRecommendationHits(
    recommendations: BatteryIncludedRecommendationHit<BatteryIncludedProduct>[],
    cap: number,
  ): ProductRecommendations {
    const crossSell: Product[] = [];
    const upSell: Product[] = [];
    const untyped: Product[] = [];

    for (const recommendation of recommendations) {
      const document = recommendation.document ?? (recommendation as unknown as BatteryIncludedProduct);
      const product = this.productMapper.mapToService(document);

      if (recommendation.type && CROSS_SELL_RECOMMENDATION_TYPES.has(recommendation.type)) {
        if (crossSell.length < cap) crossSell.push(product);
      } else if (recommendation.type && UP_SELL_RECOMMENDATION_TYPES.has(recommendation.type)) {
        if (upSell.length < cap) upSell.push(product);
      } else if (untyped.length < cap) {
        untyped.push(product);
      }
    }

    const products = [...crossSell, ...upSell, ...untyped].slice(0, cap);

    return {
      products,
      crossSell,
      upSell,
    };
  }

  private async getFallbackRecommendations(
    productId: string,
    cap: number,
    locale?: string,
  ): Promise<ProductRecommendations> {
    try {
      const sourceResult = await this.shopApi.browse({
        query: productId,
        page: 1,
        size: 10,
      });

      const biDocument =
        sourceResult.hits.find((hit) => hit.document?.id === productId || hit.document?.code === productId)?.document ??
        sourceResult.hits[0]?.document;

      const emporixProduct = await this.productService.getProductById(productId, { categories: true });
      const searchTerms = this.collectFallbackSearchTerms(locale, biDocument, emporixProduct);

      for (const term of searchTerms) {
        const products = await this.browseRelatedProducts(term, productId, cap);
        if (products.length > 0) {
          return this.toProductRecommendations(products);
        }
      }

      const popularProducts = await this.browseRelatedProducts(undefined, productId, cap);
      if (popularProducts.length > 0) {
        return this.toProductRecommendations(popularProducts);
      }

      return { products: [], crossSell: [], upSell: [] };
    } catch (error) {
      this.logger.error({ err: error, productId }, '[SearchService] Recommendation fallback failed');
      return { products: [], crossSell: [], upSell: [] };
    }
  }

  private async browseRelatedProducts(query: string | undefined, productId: string, cap: number): Promise<Product[]> {
    const relatedResult = await this.shopApi.browse({
      query,
      page: 1,
      size: cap + 1,
    });

    return relatedResult.hits
      .map((hit) => this.productMapper.mapToService(hit.document))
      .filter((product) => product.id !== productId)
      .slice(0, cap);
  }

  private collectFallbackSearchTerms(
    locale: string | undefined,
    biDocument?: BatteryIncludedProduct,
    emporixProduct?: Product,
  ): string[] {
    const terms: string[] = [];
    const add = (term?: string) => {
      const normalized = term?.trim();
      if (!normalized) return;
      if (!terms.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
        terms.push(normalized);
      }
    };

    for (const category of biDocument?.categoryAssignments ?? []) {
      add(locale ? category.localizedName?.[locale] : undefined);
      add(category.localizedName?.en);
      add(category.name);
      if (category.parent && typeof category.parent === 'object') {
        add(locale ? category.parent.localizedName?.[locale] : undefined);
        add(category.parent.localizedName?.en);
        add(category.parent.name);
      }
    }

    if (emporixProduct?.primaryCategory) {
      add(this.resolveLocalized(emporixProduct.primaryCategory.name, locale));
    }

    for (const category of emporixProduct?.categories ?? []) {
      add(this.resolveLocalized(category.name, locale));
    }

    if (emporixProduct?.brand?.name) {
      add(this.resolveLocalized(emporixProduct.brand.name, locale));
    }

    const productName =
      this.resolveLocalized(biDocument?.name, locale) ?? this.resolveLocalized(emporixProduct?.name, locale);
    if (productName) {
      for (const word of productName.split(/\s+/)) {
        if (word.length >= 5) {
          add(word);
        }
      }
    }

    if (Array.isArray(biDocument?.tags)) {
      for (const tag of biDocument.tags) {
        add(String(tag));
      }
    }

    return terms;
  }

  private resolveLocalized(value: string | LocalizedString | undefined, locale?: string): string | undefined {
    if (!value) return undefined;
    if (typeof value === 'string') return value;
    return (locale && value[locale]) || value.en || Object.values(value).find((entry) => typeof entry === 'string');
  }

  private toProductRecommendations(products: Product[]): ProductRecommendations {
    const crossSellCount = Math.max(1, Math.ceil(products.length / 2));
    return {
      products,
      crossSell: products.slice(0, crossSellCount),
      upSell: products.slice(crossSellCount),
    };
  }
}

export default BatteryIncludedSearchService;
