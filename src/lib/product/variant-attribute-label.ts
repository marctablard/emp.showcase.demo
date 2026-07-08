import type { useTranslations } from 'next-intl';
import { type ProductVariantAttributeKey, dk } from '@/i18n/dynamic-key';
import type { LocalizedString } from '@/platform/services/model/common';

type TranslateFn = ReturnType<typeof useTranslations<'product'>>;
type L10nFn = (input: string | LocalizedString | unknown) => string;

function isMissingTranslation(result: string, attributeKey: string): boolean {
  return result.includes(`productVariantAttributes.${attributeKey}`);
}

export function resolveProductVariantAttributeLabel(
  attribute: { key: string; name?: string | LocalizedString },
  t: TranslateFn,
  l10n: L10nFn,
): string {
  const messageKey = `filters.mixins.productVariantAttributes.${attribute.key}`;
  const translated = t(dk<ProductVariantAttributeKey>(messageKey as ProductVariantAttributeKey), {
    defaultValue: attribute.key,
  });

  if (!isMissingTranslation(translated, attribute.key)) {
    return translated;
  }

  if (attribute.name) {
    const labelFromName = l10n(attribute.name);
    if (labelFromName) {
      return labelFromName;
    }
  }

  return attribute.key;
}
