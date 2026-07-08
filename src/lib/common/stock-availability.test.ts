import type { StockAvailability } from '@/platform/services/model/common';
import { formatStockQuantity, getStockStatusLevel, isStockOrderable } from './stock-availability';

describe('stock-availability', () => {
  const inStock: StockAvailability = {
    productId: 'p1',
    availableQuantity: 12,
    availableInDays: null,
    isAvailable: true,
  };

  const unavailable: StockAvailability = {
    productId: 'p2',
    availableQuantity: 0,
    availableInDays: null,
    isAvailable: false,
  };

  it('treats available quantity from the service as orderable stock', () => {
    expect(isStockOrderable(inStock)).toBe(true);
    expect(formatStockQuantity(inStock, { outOfStock: 'Out of stock' })).toBe('12');
    expect(getStockStatusLevel(inStock)).toBe('in');
  });

  it('shows out of stock when the service marks the product unavailable', () => {
    expect(isStockOrderable(unavailable)).toBe(false);
    expect(formatStockQuantity(unavailable, { outOfStock: 'Out of stock' })).toBe('Out of stock');
    expect(getStockStatusLevel(unavailable)).toBe('out');
  });
});
