// c:\Workspace\emporix-showcase\src\platform\services\model\product\impl\BatteryIncludedProductMapper.ts
import { inject } from 'inversify';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedProduct } from '@/platform/integrations/batteryincluded/model/product';
import type { EmporixProduct } from '@/platform/integrations/emporix/model';
import type { Product as ServiceProduct } from '@/platform/services/model/product';
import type { LocalizedString, Price } from '../../common';
import type { CategorySuggestion, SearchSuggestions } from '../../search/SearchSuggestions';
import type { SuggestionsMapper } from '../../search/SuggestionsMapper';
import type { ProductMapper } from '../ProductMapper';
import type { Product } from '../index';
import type { EmporixProductMapper } from './EmporixProductMapper';
import { normalizeProductAttributeStringMap } from './normalizeProductAttributeStringMap';

/**
 * Maps BatteryIncluded API product format to internal Product model.
 * Since BatteryIncluded uses Emporix as its data source, we can delegate
 * the mapping to the EmporixProductMapper.
 */
@injectable('BatteryIncludedProductMapper', 'Singleton')
class BatteryIncludedProductMapper implements ProductMapper<BatteryIncludedProduct>, SuggestionsMapper {
  constructor(@inject('EmporixProductMapper') private emporixMapper: EmporixProductMapper) {}

  private toLocalizedString(value: unknown): LocalizedString {
    if (Array.isArray(value)) {
      return value.reduce<LocalizedString>((accumulator, item) => {
        if (item && typeof item.language === 'string' && typeof item.value === 'string') {
          accumulator[item.language] = item.value;
        }
        return accumulator;
      }, {});
    }

    if (value && typeof value === 'object') {
      return Object.entries(value as Record<string, unknown>).reduce<LocalizedString>((accumulator, [key, item]) => {
        if (typeof item === 'string') {
          accumulator[key] = item;
        }
        return accumulator;
      }, {});
    }

    if (typeof value === 'string' && value.length > 0) {
      return { en: value };
    }

    return {};
  }

  private getRootProduct(product: BatteryIncludedProduct): Record<string, any> {
    return (product._product as Record<string, any> | undefined) ?? product;
  }

  private getLocalizedProduct(product: BatteryIncludedProduct): Record<string, any> {
    return (product._product_i18n as Record<string, any> | undefined) ?? {};
  }

  private getSiteAwareProduct(product: BatteryIncludedProduct): Record<string, any> {
    return (product._product_siteAware as Record<string, any> | undefined) ?? {};
  }

  private getMedia(product: BatteryIncludedProduct): any[] {
    const rootProduct = this.getRootProduct(product);
    const media = rootProduct.media ?? product.media ?? product.medias;
    return Array.isArray(media) ? media : [];
  }

  private getPriceData(product: BatteryIncludedProduct): Record<string, any> | undefined {
    const siteAwareProduct = this.getSiteAwareProduct(product);
    const countryAware = siteAwareProduct.countryAware;

    if (countryAware?.price) {
      return countryAware.price as Record<string, any>;
    }

    if (countryAware && typeof countryAware === 'object') {
      for (const value of Object.values(countryAware)) {
        if (value && typeof value === 'object' && 'price' in value) {
          return (value as Record<string, any>).price as Record<string, any>;
        }
      }
    }

    if (Array.isArray(product.prices) && product.prices.length > 0) {
      return product.prices[0] as Record<string, any>;
    }

    return undefined;
  }

  private mapAvailability(product: BatteryIncludedProduct, productId: string): Product['availability'] {
    const availability = this.getSiteAwareProduct(product).availability as Record<string, any> | undefined;
    if (!availability) {
      return undefined;
    }

    const stockLevel = Number(availability.stockLevel);
    const availableQuantity = Number.isFinite(stockLevel) ? stockLevel : 0;

    return {
      productId,
      availableQuantity,
      availableInDays: null,
      isAvailable: typeof availability.available === 'boolean' ? availability.available : availableQuantity > 0,
    };
  }

  private mapBrand(product: BatteryIncludedProduct): Product['brand'] {
    const rootProduct = this.getRootProduct(product);
    const localizedBrand = this.getLocalizedProduct(product).brand as Record<string, any> | undefined;

    const brandId = localizedBrand?.id ?? rootProduct.brandId;
    if (!brandId) {
      return undefined;
    }

    return {
      id: String(brandId),
      ...(localizedBrand?.name ? { name: localizedBrand.name } : {}),
      ...(localizedBrand?.mediaUrl
        ? {
            logo: {
              url: localizedBrand.mediaUrl,
              altText: localizedBrand.name,
            },
          }
        : {}),
    };
  }

  private mapLabels(product: BatteryIncludedProduct): Product['labels'] {
    const localizedLabels = this.getLocalizedProduct(product).labels;
    if (Array.isArray(localizedLabels) && localizedLabels.length > 0) {
      return localizedLabels
        .filter((label): label is Record<string, any> => Boolean(label?.id))
        .map((label) => ({
          id: String(label.id),
          ...(label.name ? { name: label.name } : {}),
          ...(label.mediaUrl ? { image: label.mediaUrl } : {}),
          ...(label.description ? { description: label.description } : {}),
        }));
    }

    return undefined;
  }

  private mapHighlights(product: BatteryIncludedProduct): Product['highlights'] {
    const highlights = this.getRootProduct(product).mixins?.highlights?.highlights;
    if (!Array.isArray(highlights) || highlights.length === 0) {
      return undefined;
    }

    const localizedHighlights = highlights.reduce<Record<string, string[]>>((accumulator, item) => {
      if (!Array.isArray(item)) {
        return accumulator;
      }

      item.forEach((entry) => {
        if (!entry || typeof entry.language !== 'string' || typeof entry.value !== 'string') {
          return;
        }

        if (!accumulator[entry.language]) {
          accumulator[entry.language] = [];
        }
        accumulator[entry.language].push(entry.value);
      });

      return accumulator;
    }, {});

    return Object.keys(localizedHighlights).length > 0 ? localizedHighlights : undefined;
  }

  private normalizeEmporixSource(product: BatteryIncludedProduct): EmporixProduct {
    const rootProduct = this.getRootProduct(product);
    const localizedProduct = this.getLocalizedProduct(product);

    return {
      ...(rootProduct as EmporixProduct),
      id: product.id ?? rootProduct.id ?? rootProduct.code,
      code: rootProduct.code ?? product.code ?? product.id,
      name: localizedProduct.name ?? rootProduct.name ?? '',
      description: localizedProduct.description ?? rootProduct.description ?? '',
      media: this.getMedia(product),
      brandId: localizedProduct.brand?.id ?? rootProduct.brandId,
      labelIds:
        Array.isArray(localizedProduct.labels) && localizedProduct.labels.length > 0
          ? localizedProduct.labels.map((label: Record<string, any>) => label.id).filter(Boolean)
          : rootProduct.labelIds,
    };
  }

  /**
   * Maps a BatteryIncluded product to the internal Product model by delegating to EmporixProductMapper
   * @param product - The BatteryIncluded product data
   * @returns The internal Product model
   */
  mapToService(product: BatteryIncludedProduct): ServiceProduct {
    const rootProduct = this.getRootProduct(product);
    const localizedProduct = this.getLocalizedProduct(product);
    const normalizedSource = this.normalizeEmporixSource(product);
    const productData = this.emporixMapper.mapToService(normalizedSource);

    const mappedProduct: Product = {
      ...productData,
      id: String(product.id ?? rootProduct.id ?? rootProduct.code ?? productData.id),
      name: localizedProduct.name ?? productData.name,
      description: localizedProduct.description ?? productData.description,
      brand: this.mapBrand(product) ?? productData.brand,
      labels: this.mapLabels(product) ?? productData.labels,
      highlights: this.mapHighlights(product) ?? productData.highlights,
      availability: this.mapAvailability(
        product,
        String(product.id ?? rootProduct.id ?? rootProduct.code ?? productData.id),
      ),
      primaryImage: productData.primaryImage,
      images: productData.images,
    };

    const priceData = this.getPriceData(product);
    if (priceData) {
      mappedProduct.price = this.mapPrice(priceData);
    }

    const mixins = rootProduct.mixins ?? product.mixins;
    const productDataWithMixins = this.mapProductMixins(mixins, mappedProduct);

    return productDataWithMixins;
  }

  /**
   * Maps an internal Product model back to BatteryIncluded product format
   * @param service - The internal Product model
   * @returns The BatteryIncluded product data
   */
  mapToSource(service: ServiceProduct): BatteryIncludedProduct {
    // Delegate to EmporixProductMapper since they share the same structure
    // custom modifications can be included here
    const result = this.emporixMapper.mapToSource(service);
    return {
      ...result,
      medias: service.images ? service.images : [],
    };
  }

  /**
   * Maps query completions from the API response
   * @param item - The query completion item from the API response
   * @returns Array of query completion strings
   */
  mapQueryCompletions(item: any): string[] {
    const completions: string[] = [];

    if (item && item.kind === 'query-completion' && Array.isArray(item.hits)) {
      item.hits.forEach((hit: any) => {
        if (hit && hit.value) {
          completions.push(hit.value);
        }
      });
    }

    return completions;
  }

  /**
   * Maps category suggestions from the API response
   * @param item - The category facet item from the API response
   * @returns Array of category suggestions
   */
  mapCategorySuggestions(item: any): CategorySuggestion[] {
    const categories: CategorySuggestion[] = [];

    if (item && item.kind?.startsWith('facet.categoryAssignments') && Array.isArray(item.hits)) {
      item.hits.forEach((hit: any) => {
        if (hit && hit.value) {
          categories.push({
            name: hit.value,
            count: hit.count || 1,
          });
        }
      });
    }

    return categories;
  }

  /**
   * Maps product suggestions from the API response
   * @param item - The document item from the API response
   * @returns Array of product models
   */
  mapProductSuggestions(item: any): ServiceProduct[] {
    const products: ServiceProduct[] = [];

    if (item && item.kind === 'document' && Array.isArray(item.hits)) {
      item.hits.forEach((hit: any) => {
        if (hit && hit.highlighted) {
          const product = this.mapToService(hit.highlighted);
          if (hit.highlighted.prices) {
            let lowestPrice: { amount: number; currency: string } | undefined = undefined;
            hit.highlighted.prices.forEach((price: any) => {
              if (!lowestPrice || price.effectiveAmount < lowestPrice.amount) {
                lowestPrice = {
                  amount: price.effectiveAmount,
                  currency: price.currency,
                };
              }
            });
            product.price = lowestPrice;
          }
          products.push(product);
        }
      });
    }

    return products;
  }

  /**
   * Maps the complete API response to a search suggestions object
   * @param apiResponse - The complete API response array
   * @returns Search suggestions object containing query completions, products, and categories
   */
  mapSearchSuggestions(apiResponse: any[]): SearchSuggestions {
    const result: SearchSuggestions = {
      queryCompletions: [],
      products: [],
      categories: [],
    };

    if (!Array.isArray(apiResponse)) {
      return result;
    }

    apiResponse.forEach((item) => {
      if (item.kind === 'query-completion') {
        result.queryCompletions = [...result.queryCompletions, ...this.mapQueryCompletions(item)];
      } else if (item.kind === 'document') {
        result.products = [...result.products, ...this.mapProductSuggestions(item)];
      } else if (item.kind?.startsWith('facet.categoryAssignments')) {
        result.categories = [...result.categories, ...this.mapCategorySuggestions(item)];
      }
    });

    return result;
  }

  /**
   * Maps a price object to extract only effectiveAmount, currency and originalAmount
   * @param priceData - The price data from mixins
   * @returns Simplified price object with only required fields
   */
  mapPrice(priceData: any): Price {
    return {
      amount: priceData.effectiveAmount || 0,
      currency: priceData.currency || getPublicDefaultCurrency(),
      originalAmount: priceData.originalAmount || priceData.amount || 0,
    };
  }

  /**
   * Maps product mixins data to proper Product interface structure
   * @param mixins The source mixins data from API
   * @param product The existing product object to enhance
   * @returns Enhanced product object with mixins data
   */
  mapProductMixins(mixins: any, product: Product): Product {
    if (!mixins) return product;

    // Create a new object to avoid mutating the input
    const enhancedProduct: Product = { ...product };

    if (mixins.usp?.usp) {
      enhancedProduct.usps = mixins.usp.usp.map((usp: any) => ({
        icon: typeof usp.icon === 'string' ? usp.icon : usp.icon != null ? String(usp.icon) : '',
        description: this.toLocalizedString(usp.description),
      }));
    }

    if (mixins.productTemplateAttributes) {
      enhancedProduct.templateAttributes = normalizeProductAttributeStringMap(
        mixins.productTemplateAttributes as Record<string, unknown>,
      );
    }

    if (mixins.productVariantAttributes) {
      enhancedProduct.variantAttributeValues = normalizeProductAttributeStringMap(
        mixins.productVariantAttributes as Record<string, unknown>,
      );
    }

    return enhancedProduct;
  }
}

export default BatteryIncludedProductMapper;
