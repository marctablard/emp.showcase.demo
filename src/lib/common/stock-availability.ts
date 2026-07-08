import type { StockAvailability } from '@/platform/services/model/common';

export type StockStatusLevel = 'loading' | 'out' | 'low' | 'in';

export function createUnavailableStock(productId: string): StockAvailability {
  return {
    productId,
    availableQuantity: 0,
    availableInDays: null,
    isAvailable: false,
  };
}

export function isStockOrderable(availability: StockAvailability | null | undefined): boolean {
  if (!availability) {
    return false;
  }
  return availability.isAvailable && availability.availableQuantity > 0;
}

export function getStockStatusLevel(availability: StockAvailability | null | undefined): StockStatusLevel {
  if (!availability) {
    return 'loading';
  }
  if (!isStockOrderable(availability)) {
    return 'out';
  }
  if (availability.availableQuantity <= 5) {
    return 'low';
  }
  return 'in';
}

export function formatStockQuantity(
  availability: StockAvailability | null | undefined,
  labels: { outOfStock: string },
): string {
  if (!availability) {
    return '…';
  }
  if (!isStockOrderable(availability)) {
    return labels.outOfStock;
  }
  return String(availability.availableQuantity);
}
