import { formatDate } from '@/lib/date-utils';
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

function shouldFormatAsDateTime(value: string, type: ProductTemplateAttributeType | undefined): boolean {
  return type === PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.DATETIME || ISO_DATETIME_PREFIX.test(value);
}

/**
 * Formats a template-attribute value for display.
 * DATETIME (or ISO-looking values without type meta) use the shared `formatDate` helper.
 */
export function formatTemplateAttributeValue(
  value: string,
  type: ProductTemplateAttributeType | undefined,
  locale: string,
): string {
  if (shouldFormatAsDateTime(value, type)) {
    return formatDate(value, locale);
  }
  return value;
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
    if (!Object.prototype.hasOwnProperty.call(templateAttributes, key) || seen.has(key)) {
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
