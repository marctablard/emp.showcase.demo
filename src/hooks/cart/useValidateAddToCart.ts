'use client';

import { useTranslations } from 'next-intl';
import { useSession } from '@/hooks/session/useSession';
import { useSite } from '@/hooks/site/useSite';
import { isProductPriceDisplayableForPurchase } from '@/lib/common/product-price-site-context';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';

export interface AddToCartValidation {
  /** Whether the add-to-cart action is blocked by product-level rules (master product or missing price). */
  disabled: boolean;
  /** Tooltip text explaining why the button is disabled, or undefined when enabled. */
  tooltip: string | undefined;
}

/**
 * Validates whether a product can be added to cart.
 * Returns `disabled` flag and an explanatory `tooltip` when blocked.
 *
 * Rules:
 * 1. Master products (has variantAttributes + purchasable=false) cannot be carted.
 * 2. Products without a valid price for the current site/session cannot be carted.
 */
export function useValidateAddToCart(product: Product | undefined, price?: ProductPrice | null): AddToCartValidation {
  const t = useTranslations('product');
  const { session } = useSession();
  const { site } = useSite();

  if (!product) {
    return { disabled: true, tooltip: undefined };
  }

  const isMasterProduct = (product.variantAttributes?.length ?? 0) > 0 && !product.purchasable;
  if (isMasterProduct) {
    return { disabled: true, tooltip: t('cartTooltipMasterProduct') };
  }

  if (!product.purchasable) {
    return { disabled: true, tooltip: t('cartTooltipNotPurchasable') };
  }

  // Use the explicit price prop if provided, otherwise fall back to product.price
  const effectivePrice = price !== undefined ? price : product.price;
  const priceOk =
    effectivePrice != null && isProductPriceDisplayableForPurchase(effectivePrice.currency, session, site);

  if (!priceOk) {
    return { disabled: true, tooltip: t('cartTooltipNoPrice', { currency: session?.currency ?? '' }) };
  }

  return { disabled: false, tooltip: undefined };
}
