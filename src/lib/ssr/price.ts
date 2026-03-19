import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { ProductPrice } from '@/platform/services/model/price/price';
import { PriceService } from '@/platform/services/price';
import ssr from '@/platform/ssr';

const getPriceService = () => ssr.get<PriceService>('PriceService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

const _getPrice = cache(
  async (id: string, unitCode?: string, quantity?: number): Promise<ProductPrice | null | undefined> => {
    try {
      const price = await getPriceService().getProductPrice(id, quantity, unitCode);
      return price;
    } catch (error) {
      getLogger().error(
        { error: error instanceof Error ? error.message : String(error), productId: id, unitCode, quantity },
        'SSR getProductPrice failed',
      );
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
