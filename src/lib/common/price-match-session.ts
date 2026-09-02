import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import type { PriceFetchOptions } from '@/platform/services/price/PriceService';

function normalizeMatchCode(value: string | undefined): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export type PriceMatchSession = {
  siteCode?: string;
  currency?: string;
  country?: string;
  customerId?: string;
  legalEntityId?: string;
};

/**
 * Same explicit match-prices context for PDP and cart line mutations.
 * `useFallback` stays false so a main-site fallback row is never treated as buyable.
 */
export function priceFetchOptionsFromSession(
  session: PriceMatchSession | null | undefined,
  cartSiteCode?: string,
): PriceFetchOptions | undefined {
  const siteCode = cartSiteCode?.trim() || session?.siteCode?.trim();
  if (!siteCode) {
    return undefined;
  }
  const options: PriceFetchOptions = {
    siteCode,
    useFallback: false,
  };
  const currency = normalizeMatchCode(session?.currency);
  if (currency) {
    options.currency = currency;
  }
  const country = normalizeMatchCode(session?.country);
  if (country) {
    options.country = country;
  }
  if (isAuthenticatedSessionCustomerId(session?.customerId)) {
    options.customerId = session.customerId;
  }
  const legalEntityId = session?.legalEntityId?.trim();
  if (legalEntityId) {
    options.legalEntityId = legalEntityId;
  }
  return options;
}
