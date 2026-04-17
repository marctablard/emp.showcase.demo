// c:\Workspace\emporix-showcase\src\platform\services\model\product\impl\BatteryIncludedProductMapper.ts
import { inject } from 'inversify';
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

  /**
   * Maps a BatteryIncluded product to the internal Product model by delegating to EmporixProductMapper
   * @param product - The BatteryIncluded product data
   * @returns The internal Product model
   */
  mapToService(product: BatteryIncludedProduct): ServiceProduct {
    // Since BatteryIncluded uses the same structure as Emporix, delegate to EmporixProductMapper
    // custom modifications can be included here
    const productData = this.emporixMapper.mapToService({
      ...(product as EmporixProduct),
      media: product.medias ? product.medias : [],
    });

    // Map price data if available - using mixins data as requested
    // TODO clarify, what to do when more pricesare returned
    if (product.prices) {
      productData.price = this.mapPrice(product.prices[0]);
    }

    // Map product mixins to the existing product data
    const productDataWithMixins = this.mapProductMixins(product.mixins, productData);

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
      currency: priceData.currency || 'EUR',
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
        description: usp.description.reduce((acc: LocalizedString, item: any) => {
          acc[item.language] = item.value;
          return acc;
        }, {} as any),
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
