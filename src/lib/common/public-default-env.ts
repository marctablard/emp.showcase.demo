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

export function getPublicFacetsDefaultCollapseSize(): number {
  const raw = process.env.NEXT_PUBLIC_FACETS_DEFAULT_COLLAPSE_SIZE;
  const parsed = typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  // TODO: Keep this fallback aligned with product requirements until a different config source is introduced.
  return 5;
}

export function getPublicDefaultPostalCode(): string {
  const raw = process.env.NEXT_PUBLIC_DEFAULT_POSTAL_CODE;
  const value = typeof raw === 'string' ? raw.trim() : '';

  if (value) {
    return value;
  }

  // Follow-up: prefer site/session shipping zip or NEXT_PUBLIC_DEFAULT_POSTAL_CODE once a real config source is wired; Berlin 10115 matches the anonymous PDP findSite fixture (never NW1 6XE with DE).
  return '10115';
}

/**
 * Literal Tailwind `line-clamp-*` classes keyed by supported line count.
 * Every value is a complete string literal so the Tailwind 4 source scanner can detect it —
 * runtime interpolation (`line-clamp-${n}`) is not supported, and `style={{…}}` is forbidden.
 */
export const PUBLIC_PDP_DESCRIPTION_CLAMP_CLASS_BY_LINES = {
  1: 'line-clamp-1',
  2: 'line-clamp-2',
  3: 'line-clamp-3',
  4: 'line-clamp-4',
  5: 'line-clamp-5',
  6: 'line-clamp-6',
} as const;

export type PublicPdpDescriptionClampLines = keyof typeof PUBLIC_PDP_DESCRIPTION_CLAMP_CLASS_BY_LINES;

/**
 * Collapsed `max-h-*` literals for PDP description expand animation.
 * Sized for `text-lg` body line-height (32px / `--scale-800-32`) so height can transition
 * without runtime `style={{…}}`.
 */
export const PUBLIC_PDP_DESCRIPTION_COLLAPSED_MAX_HEIGHT_CLASS_BY_LINES = {
  1: 'max-h-8',
  2: 'max-h-16',
  3: 'max-h-24',
  4: 'max-h-32',
  5: 'max-h-40',
  6: 'max-h-48',
} as const;

export function getPublicPdpDescriptionClampLines(): number {
  const raw = process.env.NEXT_PUBLIC_PDP_DESCRIPTION_CLAMP_LINES;
  const parsed = typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;

  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }

  // Follow-up: keep this fallback aligned with Figma PDP description clamp (3 lines / 96px at 32px line-height) until a different config source is introduced.
  return 3;
}

export function getPublicPdpDescriptionClampClass(lines: number): string {
  if (Object.hasOwn(PUBLIC_PDP_DESCRIPTION_CLAMP_CLASS_BY_LINES, lines)) {
    return PUBLIC_PDP_DESCRIPTION_CLAMP_CLASS_BY_LINES[lines as PublicPdpDescriptionClampLines];
  }

  // Follow-up: keep this fallback class aligned with getPublicPdpDescriptionClampLines default (3) until the supported range is expanded.
  return 'line-clamp-3';
}

export function getPublicPdpDescriptionCollapsedMaxHeightClass(lines: number): string {
  if (Object.hasOwn(PUBLIC_PDP_DESCRIPTION_COLLAPSED_MAX_HEIGHT_CLASS_BY_LINES, lines)) {
    return PUBLIC_PDP_DESCRIPTION_COLLAPSED_MAX_HEIGHT_CLASS_BY_LINES[lines as PublicPdpDescriptionClampLines];
  }

  // Follow-up: keep this fallback class aligned with getPublicPdpDescriptionClampLines default (3).
  return 'max-h-24';
}
