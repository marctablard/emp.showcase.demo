import type { Site } from '@/platform/services/model/common/site';

/**
 * True when the shop session is fully known and its `siteCode` matches the URL-derived site object.
 * Prevents trusting prices while `useSite()` is still loading (`site` undefined) or before session/site
 * reconciliation (e.g. cookie session still on `main` while the PDP URL is Natura) — a window where
 * `/api/products/.../price` can return a session-scoped row that still fails `PRICE_SITE_INCOMPATIBLE` on cart.
 */
export function isPurchaseShopContextReady(
  session: { currency?: string; siteCode?: string } | null | undefined,
  site: Site | null | undefined,
): boolean {
  const cur = session?.currency?.trim();
  const sessSite = session?.siteCode?.trim();
  const urlSite = site?.code?.trim();
  if (!cur || !sessSite || !urlSite) {
    return false;
  }
  return sessSite === urlSite;
}

/** Display + cart-safe: session/site aligned, currency matches session, and currency is allowed for the site. */
export function isProductPriceDisplayableForPurchase(
  priceCurrency: string | undefined,
  session: { currency?: string; siteCode?: string } | null | undefined,
  site: Site | null | undefined,
): boolean {
  if (!isPurchaseShopContextReady(session, site)) {
    return false;
  }
  return isProductPriceDisplayableForShopContext(priceCurrency, session?.currency, site);
}

/**
 * True when `currency` is listed on the current site configuration (if the site exposes currencies).
 * When the site has no currency list yet, returns true so callers can still gate on session only.
 */
export function siteAllowsCurrency(site: Site | null | undefined, currency: string | undefined): boolean {
  if (!currency) {
    return false;
  }
  const ids = site?.currencies?.map((c) => c.id).filter(Boolean) ?? [];
  if (ids.length === 0) {
    return true;
  }
  return ids.includes(currency);
}

/**
 * Product price may only be shown when it matches the session shop currency AND is allowed for the URL site.
 * Prevents showing CHF from a prior Natura visit while the Showcase session/header are EUR (and vice versa).
 */
export function isProductPriceDisplayableForShopContext(
  priceCurrency: string | undefined,
  sessionCurrency: string | undefined,
  site: Site | null | undefined,
): boolean {
  if (!priceCurrency || !sessionCurrency) {
    return false;
  }
  if (priceCurrency !== sessionCurrency) {
    return false;
  }
  return siteAllowsCurrency(site, priceCurrency);
}

/** Returns a shallow copy with `price` removed when it must not be trusted for the current shop context. */
export function stripProductPriceIfNotDisplayableForShopContext<
  T extends { price?: { currency?: string } | null; id: string },
>(product: T, session: { currency?: string; siteCode?: string } | null | undefined, site: Site | null | undefined): T {
  if (!isPurchaseShopContextReady(session, site)) {
    return { ...product, price: undefined };
  }
  const c = product.price?.currency;
  if (!c) {
    return product;
  }
  if (isProductPriceDisplayableForShopContext(c, session?.currency, site)) {
    return product;
  }
  return { ...product, price: undefined };
}
