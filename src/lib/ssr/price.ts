import { cache } from 'react';
import { ProductPrice } from '@/platform/services/model/price/price';
import { PriceService } from '@/platform/services/price';
import ssr from '@/platform/ssr';

const getPriceService = () => ssr.get<PriceService>('PriceService');

const _getPrice = cache(
  async (id: string, unitCode?: string, quantity?: number): Promise<ProductPrice | null | undefined> => {
    try {
      const price = await getPriceService().getProductPrice(id, quantity, unitCode);
      return price;
    } catch (_error) {
      // on SSR we fail with undefined, so the Client can refetch if necessary
      return undefined;
    }
  },
);

export function getProductPrice(
  id: string,
  unitCode?: string,
  quantity?: number,
): Promise<ProductPrice | null | undefined> {
  return _getPrice(id, unitCode, quantity);
}
