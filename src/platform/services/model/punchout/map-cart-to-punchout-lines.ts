import { l10n } from '@/lib/utils';
import type { Cart, CartItem } from '@/platform/services/model/cart/cart';
import type { LocalizedString } from '@/platform/services/model/common';
import type { PunchoutOrderLine } from './punchout';

const UNSPSC_FALLBACK = '00000000';

function resolveUnspsc(item: CartItem, unspscByProductId?: Record<string, string>): string {
  const productId = item.product?.id;
  if (productId && unspscByProductId?.[productId]) {
    return unspscByProductId[productId];
  }

  const fromCartLine = item.product?.punchout?.classification?.unspsc?.trim();
  if (fromCartLine) return fromCartLine;

  return UNSPSC_FALLBACK;
}

function resolveDescription(name: string | LocalizedString | undefined): string {
  if (!name) return 'Product';
  if (typeof name === 'string') return name;
  return l10n(name);
}

function resolveManufacturerName(item: CartItem): string | undefined {
  const brand = item.product?.brand?.name;
  if (!brand) return undefined;
  if (typeof brand === 'string') return brand;
  return l10n(brand);
}

export function mapCartToPunchoutLines(
  cart: Cart,
  locale?: string,
  unspscByProductId?: Record<string, string>,
): PunchoutOrderLine[] {
  return cart.items.map((item) => ({
    sku: item.product?.sku || item.product?.id || item.id,
    description: resolveDescription(item.product?.name),
    quantity: item.quantity,
    unitPrice: item.tax?.netValue ?? item.price.amount,
    unitOfMeasure: 'EA',
    classificationCode: resolveUnspsc(item, unspscByProductId),
    manufacturerName: resolveManufacturerName(item),
    currency: item.price.currency || cart.currency,
    language: locale || 'en',
  }));
}
