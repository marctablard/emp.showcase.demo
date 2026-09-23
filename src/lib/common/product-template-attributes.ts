import { formatDate } from '@/lib/date-utils';
import { L10N_MISSING_LABEL } from '@/lib/l10n';
import type { LocalizedString } from '@/platform/services/model/common';
import type { ProductTemplateAttributeType } from '@/platform/services/model/product';

export const PRODUCT_TEMPLATE_ATTRIBUTE_TYPE = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  DATETIME: 'DATETIME',
} as const satisfies Record<string, ProductTemplateAttributeType>;

/** ISO-8601 datetime prefix — used when template type meta is not yet enriched. */
const ISO_DATETIME_PREFIX = /^\d{4}-\d{2}-\d{2}T/;
/** Date-only `YYYY-MM-DD` — Product Service may store DATE values without a time. */
const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
/** Canonical numeric value keys (no units/suffixes). */
const NUMERIC_VALUE_KEY = /^-?\d+(\.\d+)?$/;

function shouldFormatAsDateTime(value: string, type: ProductTemplateAttributeType | undefined): boolean {
  return (
    type === PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.DATETIME || ISO_DATETIME_PREFIX.test(value) || ISO_DATE_ONLY.test(value)
  );
}

function formatNumberValue(value: string, locale: string): string {
  const trimmed = value.trim();
  if (!NUMERIC_VALUE_KEY.test(trimmed)) {
    return value;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return value;
  }
  return new Intl.NumberFormat(locale).format(parsed);
}

/**
 * Formats a template / variant-attribute value for display.
 * DATETIME (or ISO-looking values without type meta) use the shared `formatDate` helper.
 * NUMBER values use the locale number formatter.
 */
export function formatTemplateAttributeValue(
  value: string,
  type: ProductTemplateAttributeType | undefined,
  locale: string,
): string {
  if (shouldFormatAsDateTime(value, type)) {
    return formatDate(value, locale);
  }
  if (type === PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.NUMBER) {
    return formatNumberValue(value, locale);
  }
  return value;
}

/**
 * True when a localized name is missing or only repeats the attribute key
 * (`expand=template` / product `variantAttributes[].name` often echo the key).
 */
export function isPlaceholderAttributeLabel(name: LocalizedString | string | undefined, key: string): boolean {
  if (name == null) {
    return true;
  }
  if (typeof name === 'string') {
    const trimmed = name.trim();
    return trimmed.length === 0 || trimmed === key;
  }
  const values = Object.values(name).filter(
    (value): value is string => typeof value === 'string' && value.trim().length > 0,
  );
  return values.every((value) => value.trim() === key);
}

/**
 * Localized label for a variant / template attribute key.
 * Prefers a real localized name, then a name that only repeats the key
 * (`Width`, `Max-Operating-Pressure`, `a-number-attribute-9`).
 * Returns '-' only when no localized name exists.
 * A hyphen or underscore inside a present name is storefront copy, not a reason to hide it.
 * Never uses missing i18n paths that would render as `filters.mixins…`.
 */
export function resolveVariantAttributeLabel(
  key: string,
  name: LocalizedString | string | undefined,
  labels: Record<string, LocalizedString> | undefined,
  l10n: (value: LocalizedString | string) => string,
): string {
  const candidates = [name, labels?.[key]];
  let keyEcho: string | undefined;
  for (const candidate of candidates) {
    if (candidate == null) {
      continue;
    }
    const localized = l10n(candidate).trim();
    if (localized.length === 0 || localized === L10N_MISSING_LABEL) {
      continue;
    }
    // Remember a name that only repeats the key, then keep looking for a distinct label.
    if (isPlaceholderAttributeLabel(candidate, key)) {
      keyEcho ??= localized;
      continue;
    }
    return localized;
  }
  return keyEcho ?? L10N_MISSING_LABEL;
}

/**
 * Localized variant-value label (`value.name`, e.g. qualifier `ghz` → "1 GHz").
 * Returns undefined when the name is missing or only repeats the value key, so callers
 * can fall back to the formatted key.
 */
export function resolveVariantAttributeValueLabel(
  valueKey: string,
  name: LocalizedString | string | undefined,
  l10n: (value: LocalizedString | string) => string,
): string | undefined {
  if (name == null || isPlaceholderAttributeLabel(name, valueKey)) {
    return undefined;
  }
  const localized = l10n(name).trim();
  if (localized.length === 0 || localized === L10N_MISSING_LABEL || localized === valueKey) {
    return undefined;
  }
  return localized;
}

/**
 * Resolves the display label for a product template attribute.
 * Prefers BE template `attributes[].name` (localized); falls back to the attribute key —
 * never to a missing i18n path that would render as a raw key string.
 */
export function resolveTemplateAttributeLabel(
  key: string,
  labels: Record<string, LocalizedString> | undefined,
  l10n: (value: LocalizedString | string) => string,
): string {
  const fromTemplate = labels?.[key];
  if (!fromTemplate) {
    return key;
  }
  const localized = l10n(fromTemplate).trim();
  return localized.length > 0 ? localized : key;
}

/**
 * Parses a template-attribute value as a boolean for icon display.
 * Accepts BOOLEAN-typed values and, when type meta is missing, exact case-insensitive `true` / `false`.
 * Non-BOOLEAN typed attributes are never coerced, even if the raw value looks boolean.
 */
export function parseBooleanTemplateAttributeValue(
  value: string,
  type: ProductTemplateAttributeType | undefined,
): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized !== 'true' && normalized !== 'false') {
    return undefined;
  }
  if (type !== undefined && type !== PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.BOOLEAN) {
    return undefined;
  }
  return normalized === 'true';
}

/**
 * Lists template-attribute entries for display.
 * Prefer `order` from Product Templates `attributes[]`; never sort A–Z.
 * Keys present only on the mixin map (not in `order`) are appended in their original map order.
 */
export function orderedTemplateAttributeEntries(
  templateAttributes: Record<string, string> | undefined,
  order?: readonly string[],
): Array<[string, string]> {
  if (!templateAttributes) {
    return [];
  }

  const seen = new Set<string>();
  const entries: Array<[string, string]> = [];

  for (const key of order ?? []) {
    if (!Object.hasOwn(templateAttributes, key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push([key, templateAttributes[key]]);
  }

  for (const [key, value] of Object.entries(templateAttributes)) {
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    entries.push([key, value]);
  }

  return entries;
}
