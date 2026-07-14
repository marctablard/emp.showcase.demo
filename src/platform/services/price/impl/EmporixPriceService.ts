import { inject } from 'inversify';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { resolveLegalEntityIdFromSessionAndCustomer } from '@/lib/common/legal-entity-context';
import { getPublicPriceMatchUseFallback } from '@/lib/common/public-default-env';
import { injectable } from '@/platform/core/di/injectable';
import type {
  EmporixMatchPricesRequest,
  EmporixMatchedPrice,
  EmporixPriceMatchItem,
} from '@/platform/integrations/emporix/model/price';
import type { EmporixPriceApi } from '@/platform/integrations/emporix/price/EmporixPriceApi';
import type { ProductPrice } from '@/platform/services/model/price';
import type PriceMapper from '@/platform/services/model/price/impl/EmporixPriceMapper';
import type { CustomerService } from '../../customer/CustomerService';
import type { SessionService } from '../../session/SessionService';
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
    @inject('SessionService') private sessionService: SessionService,
    @inject('CustomerService') private customerService: CustomerService,
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
      const resolvedParams = await this.resolvePriceFetchParams(params);
      matchedPrices = await this.priceApi.matchPrices(
        this.buildMatchPricesRequest(resolvedParams, [this.mapToMatchPriceItem(productId, quantity, unitCode)]),
      );
    }
    const requestedCurrency = params?.currency;
    const preferredPrice = this.pickPreferredMatchedPrice(matchedPrices, requestedCurrency);
    const price = preferredPrice ? this.mapper.mapToService(preferredPrice) : null;
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
        const resolvedParams = await this.resolvePriceFetchParams(params);
        matchedPrices = await this.priceApi.matchPrices(this.buildMatchPricesRequest(resolvedParams, items));
      }
      allMatched.push(...matchedPrices);
    }

    const requestedCurrency = params?.currency;
    const matchesByProductId = new Map<string, EmporixMatchedPrice[]>();

    allMatched.forEach((matched) => {
      const productId = matched.itemId.id;
      const productMatches = matchesByProductId.get(productId) ?? [];
      productMatches.push(matched);
      matchesByProductId.set(productId, productMatches);
    });

    productIds.forEach((productId) => {
      const preferredPrice = this.pickPreferredMatchedPrice(matchesByProductId.get(productId) ?? [], requestedCurrency);
      result.set(productId, preferredPrice ? this.mapper.mapToService(preferredPrice) : null);
    });

    return result;
  }

  private async resolvePriceFetchParams(params: PriceFetchOptions): Promise<PriceFetchOptions> {
    const resolved = { ...params };

    if (!resolved.currency || !resolved.country) {
      const site = await this.siteService.getSite(resolved.siteCode);
      if (!site) {
        throw new Error(`Site ${resolved.siteCode} not found`);
      }
      if (!resolved.currency) {
        resolved.currency = site.defaultCurrency.id;
      }
      if (!resolved.country) {
        resolved.country = site.defaultCountry;
      }
    }

    if (!resolved.legalEntityId?.trim()) {
      const legalEntityId = await this.resolveLegalEntityIdForPricing();
      if (legalEntityId) {
        resolved.legalEntityId = legalEntityId;
      }
    }

    return resolved;
  }

  private async resolveLegalEntityIdForPricing(): Promise<string | undefined> {
    const session = await this.sessionService.getCurrent();
    if (!session || !isAuthenticatedSessionCustomerId(session.customerId)) {
      return undefined;
    }

    const customer = await this.customerService.getCustomer();
    return resolveLegalEntityIdFromSessionAndCustomer(session, customer);
  }

  private buildMatchPricesRequest(
    params: PriceFetchOptions,
    items: EmporixPriceMatchItem[],
  ): EmporixMatchPricesRequest {
    return {
      targetCurrency: params.currency!,
      siteCode: params.siteCode,
      targetLocation: {
        countryCode: params.country!,
      },
      items,
      ...(params.legalEntityId ? { legalEntityId: params.legalEntityId } : {}),
      useFallback: getPublicPriceMatchUseFallback(),
    };
  }

  private pickPreferredMatchedPrice(
    matchedPrices: EmporixMatchedPrice[],
    requestedCurrency?: string,
  ): EmporixMatchedPrice | null {
    if (matchedPrices.length === 0) {
      return null;
    }

    if (!requestedCurrency) {
      return matchedPrices[0];
    }

    const exactCurrencyMatch = matchedPrices.find((matchedPrice) => matchedPrice.currency === requestedCurrency);
    return exactCurrencyMatch ?? matchedPrices[0];
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
