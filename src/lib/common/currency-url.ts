export const CURRENCY_QUERY_PARAM = 'currency';

const ISO_4217_CODE = /^[A-Za-z]{3}$/;

type SiteCurrencySource = {
  defaultCurrency?: { id?: string; code?: string };
  currencies?: Array<{ id?: string; code?: string }>;
};

/**
 * Parse a storefront `?currency=` value. Returns an uppercase ISO 4217 code, or
 * `undefined` when the value is missing or not a 3-letter code.
 */
export function parseCurrencyQueryParam(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || !ISO_4217_CODE.test(trimmed)) {
    return undefined;
  }
  return trimmed.toUpperCase();
}

/**
 * Whether `currency` is listed on the site (default + `currencies[]`, id or code).
 * When the site has no currency metadata yet, returns true so the session API can decide.
 */
export function isCurrencyAllowedOnSite(site: SiteCurrencySource | null | undefined, currency: string): boolean {
  const supported = new Set<string>();
  const add = (value?: string) => {
    if (value) {
      supported.add(value.toUpperCase());
    }
  };
  add(site?.defaultCurrency?.id);
  add(site?.defaultCurrency?.code);
  for (const entry of site?.currencies ?? []) {
    add(entry.id);
    add(entry.code);
  }
  if (supported.size === 0) {
    return true;
  }
  return supported.has(currency.toUpperCase());
}

/** Set or remove `currency` on a storefront path + query string. */
export function replaceCurrencySearchParam(pathname: string, search: string, currency: string | null): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(raw);
  if (currency) {
    params.set(CURRENCY_QUERY_PARAM, currency);
  } else {
    params.delete(CURRENCY_QUERY_PARAM);
  }
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * Copy an existing storefront `?currency=` onto a newly built browse URL.
 * Does not invent a currency from session — keep defaults out of the URL.
 */
export function copyStorefrontCurrencyParam(from: URLSearchParams, to: URLSearchParams): void {
  const value = from.get(CURRENCY_QUERY_PARAM);
  if (value) {
    to.set(CURRENCY_QUERY_PARAM, value);
  }
}

/**
 * After a header currency switch, keep an existing `?currency=` in sync with the
 * new session currency. Returns null when the storefront has no currency query
 * (do not inject defaults) or it already matches.
 */
export function storefrontCurrencyHrefAfterSwitch(
  pathname: string,
  search: string,
  nextCurrency: string,
): string | null {
  const current = parseCurrencyQueryParam(new URLSearchParams(search).get(CURRENCY_QUERY_PARAM));
  if (!current || current === nextCurrency) {
    return null;
  }
  return replaceCurrencySearchParam(pathname, search, nextCurrency);
}
