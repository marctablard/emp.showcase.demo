'use client';

import { useEffect, useRef } from 'react';
import { useLogger } from '@/hooks/common/useLogger';
import { useSession } from '@/hooks/session/useSession';
import { useShippingMethods } from '@/hooks/shipping/useShippingMethods';
import { getPublicDefaultCountry, getPublicDefaultPostalCode } from '@/lib/common/public-default-env';
import { resolveDefaultShippingCost } from '@/lib/common/shipping-cost';
import type { ProductPrice } from '@/platform/services/model/price';

export interface UsePdpShippingCostResult {
  shippingCost: number | undefined;
  postalCode: string;
  loading: boolean;
  error: Error | null;
}

/**
 * Explicit PDP shipping fetch (useShippingMethods does not auto-fetch).
 * Anonymous contract: session country when set, else getPublicDefaultCountry();
 * getPublicDefaultPostalCode() (10115) when no session shipping zip; orderValue = price.amount × qty.
 */
export function usePdpShippingCost(price: ProductPrice | null | undefined, quantity: number): UsePdpShippingCostResult {
  const logger = useLogger();
  const { session } = useSession();
  const { shippingMethods, loading, error, fetchShippingMethods } = useShippingMethods();
  const lastRatesKeyRef = useRef<string | null>(null);

  const countryCode = session?.country || getPublicDefaultCountry();
  // Follow-up: prefer session/cart shipping zip when a session shipping address is available.
  const postalCode = getPublicDefaultPostalCode();

  const priceAmount = price?.amount;
  const priceCurrency = price?.currency;

  useEffect(() => {
    if (priceAmount === undefined || !priceCurrency || !Number.isFinite(priceAmount)) {
      lastRatesKeyRef.current = null;
      return;
    }

    if (!countryCode || !postalCode) {
      return;
    }

    const orderValue = {
      amount: priceAmount * quantity,
      currency: priceCurrency,
    };
    const amountKey = `${orderValue.currency}:${(Math.round(orderValue.amount * 100) / 100).toFixed(2)}`;
    const ratesKey = `${countryCode}|${postalCode}|${amountKey}`;

    if (ratesKey === lastRatesKeyRef.current) {
      return;
    }
    lastRatesKeyRef.current = ratesKey;

    void fetchShippingMethods(countryCode, postalCode, orderValue);
  }, [countryCode, postalCode, priceAmount, priceCurrency, quantity, fetchShippingMethods]);

  useEffect(() => {
    if (!error) {
      return;
    }
    logger.error({ err: error }, 'Error fetching PDP shipping methods');
  }, [error, logger]);

  return {
    shippingCost: resolveDefaultShippingCost(shippingMethods),
    postalCode,
    loading,
    error,
  };
}
