/**
 * Each caller must pass a **static** `process.env.NEXT_PUBLIC_*` expression as `raw`.
 * Next.js only inlines public env vars for direct member access; `process.env[key]` is
 * always undefined in the browser bundle, which breaks client components (e.g. `formatCurrency`).
 */
function requiredPublicEnvVar(key: string, raw: string | undefined): string {
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getPublicDefaultCurrency(): string {
  return requiredPublicEnvVar('NEXT_PUBLIC_DEFAULT_CURRENCY', process.env.NEXT_PUBLIC_DEFAULT_CURRENCY);
}

export function getPublicDefaultSite(): string {
  return requiredPublicEnvVar('NEXT_PUBLIC_DEFAULT_SITE', process.env.NEXT_PUBLIC_DEFAULT_SITE);
}

export function getPublicDefaultLanguage(): string {
  return requiredPublicEnvVar('NEXT_PUBLIC_DEFAULT_LANGUAGE', process.env.NEXT_PUBLIC_DEFAULT_LANGUAGE);
}

export function getPublicDefaultCountry(): string {
  return requiredPublicEnvVar('NEXT_PUBLIC_DEFAULT_COUNTRY', process.env.NEXT_PUBLIC_DEFAULT_COUNTRY);
}

export function getPublicDefaultRegion(): string {
  return requiredPublicEnvVar('NEXT_PUBLIC_DEFAULT_REGION', process.env.NEXT_PUBLIC_DEFAULT_REGION);
}

export function getPublicDefaultUnitCode(): string {
  return requiredPublicEnvVar(
    'NEXT_PUBLIC_EMPORIX_DEFAULT_UNIT_CODE',
    process.env.NEXT_PUBLIC_EMPORIX_DEFAULT_UNIT_CODE,
  );
}

export function getPublicPriceMatchUseFallback(): boolean {
  const raw = process.env.NEXT_PUBLIC_FALLBACK_PRICES;
  if (typeof raw !== 'string') {
    return false;
  }
  const normalized = raw.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}
