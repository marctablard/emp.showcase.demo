'use client';

import { useEffect, useRef, useState } from 'react';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import { fetchProductAvailability } from '@/lib/client/availability';
import { fetchProductPrice } from '@/lib/client/prices';
import {
  isProductPriceDisplayableForPurchase,
  isPurchaseShopContextReady,
} from '@/lib/common/product-price-site-context';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { StockAvailability } from '@/platform/services/model/common';
import type { Site } from '@/platform/services/model/common/site';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import type { Session } from '@/platform/services/model/session/session';

interface UsePdpPurchaseDataResult {
  price: ProductPrice | null | undefined;
  availability: StockAvailability | undefined;
}

function hasPurchasePriceSemantics(price: ProductPrice): boolean {
  return typeof price.tax?.netValue === 'number' || price.includesTax === false;
}

/**
 * Keeps PDP price + availability aligned with the current shop/session context.
 */
export function usePdpPurchaseData(
  product: Product | null | undefined,
  session: Session | null | undefined,
  site: Site | null | undefined,
): UsePdpPurchaseDataResult {
  const [price, setPrice] = useState<ProductPrice | null | undefined>(product?.price);
  const [availability, setAvailability] = useState<StockAvailability | undefined>(product?.availability);
  const priceSyncGenerationRef = useRef(0);
  const availabilitySyncGenerationRef = useRef(0);

  useEffect(() => {
    const syncGeneration = ++priceSyncGenerationRef.current;
    let cancelled = false;

    const syncPrice = async (): Promise<void> => {
      if (!product?.id) {
        setPrice(undefined);
        return;
      }

      if (!session?.currency || !session?.siteCode || !isPurchaseShopContextReady(session, site)) {
        setPrice(undefined);
        return;
      }

      const embedded = product.price;
      if (
        embedded?.currency &&
        hasPurchasePriceSemantics(embedded) &&
        isProductPriceDisplayableForPurchase(embedded.currency, session, site)
      ) {
        setPrice(embedded);
        return;
      }

      const nextPrice = await fetchProductPrice(product.id, undefined, undefined, session.currency);
      if (cancelled || syncGeneration !== priceSyncGenerationRef.current) {
        return;
      }
      if (nextPrice?.currency && !isProductPriceDisplayableForPurchase(nextPrice.currency, session, site)) {
        getLogger().warn(
          {
            productId: product.id,
            currency: nextPrice.currency,
            sessionCurrency: session.currency,
            siteCode: site?.code,
          },
          'Rejected product price API response — currency not allowed for current shop context',
        );
        setPrice(null);
        return;
      }
      setPrice(nextPrice);
    };

    const cancelStart = startEffectTask(syncPrice);
    return () => {
      cancelled = true;
      cancelStart();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on product id and embedded price fields, not product object identity
  }, [
    product?.id,
    product?.price?.id,
    product?.price?.currency,
    product?.price?.amount,
    product?.price?.includesTax,
    product?.price?.tax?.netValue,
    session,
    site,
  ]);

  useEffect(() => {
    const syncGeneration = ++availabilitySyncGenerationRef.current;
    let cancelled = false;

    const syncAvailability = async (): Promise<void> => {
      if (!product?.id) {
        setAvailability(undefined);
        return;
      }

      if (!session?.currency || !session?.siteCode || !isPurchaseShopContextReady(session, site)) {
        setAvailability(undefined);
        return;
      }

      setAvailability(undefined);

      try {
        const nextAvailability = await fetchProductAvailability(product.id);
        if (cancelled || syncGeneration !== availabilitySyncGenerationRef.current) {
          return;
        }
        setAvailability(nextAvailability);
      } catch {
        if (cancelled || syncGeneration !== availabilitySyncGenerationRef.current) {
          return;
        }
        setAvailability(undefined);
      }
    };

    const cancelStart = startEffectTask(syncAvailability);
    return () => {
      cancelled = true;
      cancelStart();
    };
  }, [product?.id, session, site]);

  return { price, availability };
}
