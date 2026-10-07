'use client';

import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { isProductPriceDisplayableForPurchase } from '@/lib/common/product-price-site-context';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';

export interface AddToCartValidation {
  disabled: boolean;
  tooltip: string | undefined;
}

/**
 * Shared validation for "add to cart" and "add to wishlist": non-sellable hierarchy nodes,
 * master products, and unpriced products are blocked in both flows. Pass `scope: 'wishlist'`
 * to get wishlist-worded tooltips where those keys exist.
 */
export function useValidateAddToCart(
  product: Product | undefined,
  price?: ProductPrice | null,
  scope: 'cart' | 'wishlist' = 'cart',
): AddToCartValidation {
  const t = useTranslations('product');
  const { session } = useSession();
  const { site } = useSite();

  if (!product) {
    return { disabled: true, tooltip: undefined };
  }

  // COP-5507: sellable === false before the master-product test so a DYNAMIC_VARIANT
  // grouping node with union axes does not show cartTooltipMasterProduct.
  if (product.sellable === false) {
    return { disabled: true, tooltip: t('cartTooltipNotSellable') };
  }

  const isMasterProduct = (product.variantAttributes?.length ?? 0) > 0 && !product.purchasable;
  if (isMasterProduct) {
    return { disabled: true, tooltip: t(`${scope}TooltipMasterProduct`) };
  }

  if (!product.purchasable) {
    return { disabled: true, tooltip: t('cartTooltipNotPurchasable') };
  }

  // Use the explicit price prop if provided, otherwise fall back to product.price.
  const effectivePrice = price !== undefined ? price : product.price;
  const priceOk =
    effectivePrice != null && isProductPriceDisplayableForPurchase(effectivePrice.currency, session, site);

  if (!priceOk) {
    return { disabled: true, tooltip: t(`${scope}TooltipNoPrice`, { currency: session?.currency ?? '' }) };
  }

  return { disabled: false, tooltip: undefined };
}
