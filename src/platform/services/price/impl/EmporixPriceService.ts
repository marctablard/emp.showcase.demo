import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixMatchPricesRequest,
  EmporixMatchedPrice,
  EmporixPriceMatchItem,
} from '@/platform/integrations/emporix/model/price';
import type { EmporixPriceApi } from '@/platform/integrations/emporix/price/EmporixPriceApi';
import type { ProductPrice } from '@/platform/services/model/price';
import type PriceMapper from '@/platform/services/model/price/impl/EmporixPriceMapper';
import type { SiteService } from '../../site/SiteService';
import type { PriceFetchOptions, PriceService } from '../PriceService';

/**
 * Implementation of PriceService for Emporix price data.
 * Maps between Emporix API price format and internal Price model.
 */
@injectable('PriceService', 'Singleton')
class EmporixPriceService implements PriceService {
  constructor(
    @inject('EmporixPriceApi') private priceApi: EmporixPriceApi,
    @inject('EmporixPriceMapper') private mapper: PriceMapper,
    @inject('SiteService') private siteService: SiteService,
  ) {}

  async getProductPrice(
    productId: string,
    quantity: number = 1,
    unitCode?: string,
    params?: PriceFetchOptions,
  ): Promise<ProductPrice | null> {
    const items = [this.mapToMatchPriceItem(productId, quantity, unitCode)];
    let matchedPrices: EmporixMatchedPrice[];
    if (!params) {
      matchedPrices = await this.priceApi.matchPricesByContext({
        items,
      });
    } else {
      if (!params.currency || !params.country) {
        const site = await this.siteService.getSite(params.siteCode);
        if (!site) {
          throw new Error(`Site ${params.siteCode} not found`);
        }
        if (!params.currency) {
          params.currency = site.defaultCurrency.id;
        }
        if (!params.country) {
          params.country = site.defaultCountry;
        }
      }
      const matchRequest: EmporixMatchPricesRequest = {
        targetCurrency: params.currency!,
        siteCode: params.siteCode,
        targetLocation: {
          countryCode: params.country!,
        },
        items: [this.mapToMatchPriceItem(productId, quantity, unitCode)],
        useFallback: true, //TODO: confirm if it should be true by default, or if it should be configurable via account settings, endpoint or ENVs
      };
      matchedPrices = await this.priceApi.matchPrices(matchRequest);
    }
    const price = matchedPrices.length > 0 ? this.mapper.mapToService(matchedPrices[0]) : null;
    // TODO clarify, what to do when more prices match?
    return price;
  }

  async getProductPrices(
    productIds: string[],
    quantity: number = 1,
    unitCode?: string,
    params?: PriceFetchOptions,
  ): Promise<Map<string, ProductPrice | null>> {
    const result = new Map<string, ProductPrice | null>();
    if (productIds.length === 0) return result;

    const BATCH_SIZE = 200;
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += BATCH_SIZE) {
      chunks.push(productIds.slice(i, i + BATCH_SIZE));
    }

    const allMatched: EmporixMatchedPrice[] = [];

    for (const chunk of chunks) {
      const items = chunk.map((id) => this.mapToMatchPriceItem(id, quantity, unitCode));

      let matchedPrices: EmporixMatchedPrice[];
      if (!params) {
        matchedPrices = await this.priceApi.matchPricesByContext({ items });
      } else {
        if (!params.currency || !params.country) {
          const site = await this.siteService.getSite(params.siteCode);
          if (!site) {
            throw new Error(`Site ${params.siteCode} not found`);
          }
          if (!params.currency) {
            params.currency = site.defaultCurrency.id;
          }
          if (!params.country) {
            params.country = site.defaultCountry;
          }
        }
        matchedPrices = await this.priceApi.matchPrices({
          targetCurrency: params.currency!,
          siteCode: params.siteCode,
          targetLocation: { countryCode: params.country! },
          items,
          useFallback: true,
        });
      }
      allMatched.push(...matchedPrices);
    }

    // Initialize all requested IDs to null
    productIds.forEach((id) => result.set(id, null));

    // Map matched prices by product ID (first match wins)
    allMatched.forEach((matched) => {
      const productId = matched.itemId.id;
      if (result.has(productId) && result.get(productId) === null) {
        result.set(productId, this.mapper.mapToService(matched));
      }
    });

    return result;
  }

  private mapToMatchPriceItem(productId: string, quantity: number, unitCode?: string): EmporixPriceMatchItem {
    const matchPrice: EmporixPriceMatchItem = {
      itemId: {
        itemType: 'PRODUCT',
        id: productId,
      },
      quantity: {
        quantity,
      },
    };
    if (unitCode) {
      matchPrice.quantity.unitCode = unitCode;
    }
    return matchPrice;
  }
}

export default EmporixPriceService;
