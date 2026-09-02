import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import type { PriceFetchOptions } from '@/platform/services/price/PriceService';

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
  if (session?.currency) {
    options.currency = session.currency;
  }
  if (session?.country) {
    options.country = session.country;
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
