export type SiteCountrySource = {
  defaultCountry?: string;
  countries?: Array<string | { code?: string }>;
  shipToCountries?: Array<string | { code?: string }>;
};

function normalizeCountryCode(value: string | undefined | null): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function countryCodesFromList(list: Array<string | { code?: string }> | undefined): string[] {
  if (!list?.length) {
    return [];
  }
  const codes: string[] = [];
  for (const entry of list) {
    const raw = typeof entry === 'string' ? entry : entry?.code;
    const code = normalizeCountryCode(raw);
    if (code) {
      codes.push(code);
    }
  }
  return codes;
}

/** Countries the shopper may keep when landing on this site (sell-to + ship-to). */
export function siteAllowedCountryCodes(site: SiteCountrySource | null | undefined): string[] {
  if (!site) {
    return [];
  }
  return [...countryCodesFromList(site.countries), ...countryCodesFromList(site.shipToCountries)];
}

export function siteAllowsCountry(site: SiteCountrySource | null | undefined, country: string | undefined): boolean {
  const code = normalizeCountryCode(country);
  if (!code) {
    return false;
  }
  const allowed = siteAllowedCountryCodes(site);
  // Unknown allow-list: do not snap a shopper-selected country away.
  if (allowed.length === 0) {
    return true;
  }
  return allowed.includes(code);
}

/**
 * Keep the current country when the site lists it; otherwise use the site default
 * (`CH` on fw-site). Never falls back to a global env default.
 */
export function resolveCountryForSite(
  site: SiteCountrySource | null | undefined,
  currentCountry: string | undefined,
): string | undefined {
  const current = normalizeCountryCode(currentCountry);
  if (current && siteAllowsCountry(site, current)) {
    return current;
  }
  const siteDefault = normalizeCountryCode(site?.defaultCountry);
  return siteDefault || current || undefined;
}
