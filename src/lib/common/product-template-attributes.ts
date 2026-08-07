import { formatDate } from '@/lib/date-utils';
import type { ProductTemplateAttributeType } from '@/platform/services/model/product';

export const PRODUCT_TEMPLATE_ATTRIBUTE_TYPE = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  BOOLEAN: 'BOOLEAN',
  DATETIME: 'DATETIME',
} as const satisfies Record<string, ProductTemplateAttributeType>;

/**
 * Formats a template-attribute value for display.
 * DATETIME values use the shared `formatDate` helper; other types pass through.
 */
export function formatTemplateAttributeValue(
  value: string,
  type: ProductTemplateAttributeType | undefined,
  locale: string,
): string {
  if (type === PRODUCT_TEMPLATE_ATTRIBUTE_TYPE.DATETIME) {
    return formatDate(value, locale);
  }
  return value;
}
