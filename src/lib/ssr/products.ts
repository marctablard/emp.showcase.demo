import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { Paginated, StockAvailability } from '@/platform/services/model/common';
import { Product } from '@/platform/services/model/product';
import { ProductFetchOptions, ProductService } from '@/platform/services/product';
import { StockService } from '@/platform/services/stock/StockService';
import ssr from '@/platform/ssr';

const getProductService = () => ssr.get<ProductService>('ProductService');
const getStockService = () => ssr.get<StockService>('StockService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

// "options" need to be a String, otherwise the cache will not work
// (every object instance is considered a different parameter, regardless of its contents)
const _getProduct = cache(async (id: string, optionsJson: string): Promise<Product | null | undefined> => {
  try {
    const options: ProductFetchOptions | undefined = optionsJson ? JSON.parse(optionsJson) : undefined;
    const product = await getProductService().getProductById(id, options);
    return product || null;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), productId: id },
      'SSR getProductById failed',
    );
    return undefined;
  }
});

const _getProducts = cache(async (page: number, size: number, optionsJson: string): Promise<Paginated<Product>> => {
  try {
    const options: ProductFetchOptions | undefined = optionsJson ? JSON.parse(optionsJson) : undefined;
    const products = await getProductService().getProducts(page, size, options);
    return products;
  } catch (_error) {
    getLogger().error({ error: _error instanceof Error ? _error.message : String(_error) }, 'SSR getProducts failed');
    return { items: [], total: 0, page: 0, pageSize: 0 };
  }
});

const _getAvailability = cache(async (site: string, id: string): Promise<StockAvailability | null | undefined> => {
  try {
    const availability = await getStockService().getStockAvailability(site, id);
    return availability || null;
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), site, productId: id },
      'SSR getStockAvailability failed',
    );
    return undefined;
  }
});

export function getAvailability(site: string, id: string): Promise<StockAvailability | null | undefined> {
  return _getAvailability(site, id);
}

export function getProductById(id: string, options?: ProductFetchOptions): Promise<Product | null | undefined> {
  const optionsJson = options ? JSON.stringify(options) : '';
  return _getProduct(id, optionsJson);
}

export function getProducts(page?: number, size?: number, options?: ProductFetchOptions): Promise<Paginated<Product>> {
  const optionsJson = options ? JSON.stringify(options) : '';
  return _getProducts(page || 0, size || 20, optionsJson);
}
