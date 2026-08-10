'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import { TemplateAttributeValue } from '@/components/product/template-attribute-value';
import { useL10n } from '@/hooks/useL10n';
import { type ProductAttributeKey, dk } from '@/i18n/dynamic-key';
import { Link } from '@/i18n/navigation';
import { clearMarkHighlights } from '@/lib/common/clear-mark-highlights';
import {
  formatTemplateAttributeValue,
  orderedTemplateAttributeEntries,
  parseBooleanTemplateAttributeValue,
  resolveTemplateAttributeLabel,
} from '@/lib/common/product-template-attributes';
import { formatCurrency } from '@/lib/utils';
import type { LocalizedString } from '@/platform/services/model/common';
import type { Product } from '@/platform/services/model/product';

interface ProductTileProps {
  product: Product;
  className?: string;
  onProductClick?: () => void;
  keyword?: string;
}

// Helper function to capitalize words and format text
const formatAttributeKey = (key: string) => {
  return key
    .replace(/([A-Z])/g, ' $1') // Insert space before capital letters
    .replace(/^./, (str) => str.toUpperCase()) // Uppercase first letter
    .trim();
};

// Helper function to mark text without creating a p element
const markText = (text: unknown, keyword?: string): React.ReactNode => {
  const safeText = text == null ? '' : String(text);
  if (!keyword || !safeText) return safeText;

  // Check if the text contains HTML tags like <mark>
  if (safeText.includes('<mark>')) {
    // Extract content between <mark> tags and make it bold
    const parts = safeText.split(/<\/?mark>/g);
    return parts.map((part, index) => {
      // Every odd index is content that was between <mark> tags
      if (index % 2 === 1) {
        return (
          <span key={index} className="font-bold">
            {part}
          </span>
        );
      }
      return part;
    });
  }

  // Regular search keyword highlighting
  try {
    // Escape special regex characters in the keyword
    const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword.trim().split(' ').join('|')})`, 'gi');
    const parts = safeText.split(regex);

    return parts.map((part, index) => {
      if (
        part.toLowerCase() === keyword.toLowerCase() ||
        keyword
          .toLowerCase()
          .split(' ')
          .some((word) => part.toLowerCase() === word)
      ) {
        return (
          <span key={index} className="font-bold">
            {part}
          </span>
        );
      }
      return part;
    });
  } catch (_e) {
    // Fallback in case of regex error
    return safeText;
  }
};

// Helper function to render product attributes
const renderAttributes = (
  attributes: Record<string, string>,
  t: (key: ProductAttributeKey, opts?: { defaultValue?: string }) => string,
  attributeType: 'productVariantAttributes' | 'productTemplateAttributes',
  options?: {
    maxItems?: number;
    isBold?: boolean;
    keyword?: string;
    locale?: string;
    templateAttributeLabels?: Product['templateAttributeLabels'];
    templateAttributeTypes?: Product['templateAttributeTypes'];
    l10n?: (value: LocalizedString | string) => string;
  },
) => {
  const entries = Object.entries(attributes);
  const limitedEntries = options?.maxItems ? entries.slice(0, options.maxItems) : entries;

  return limitedEntries.map(([key, value]) => {
    const label =
      attributeType === 'productTemplateAttributes' && options?.l10n
        ? resolveTemplateAttributeLabel(key, options.templateAttributeLabels, options.l10n)
        : t(dk<ProductAttributeKey>(`filters.mixins.${attributeType}.${key}`), {
            defaultValue: formatAttributeKey(key),
          });

    const attributeTypeMeta = options?.templateAttributeTypes?.[key];
    const locale = options?.locale ?? 'en';
    const isTemplateAttribute = attributeType === 'productTemplateAttributes';
    const isTemplateBoolean =
      isTemplateAttribute && parseBooleanTemplateAttributeValue(value, attributeTypeMeta) !== undefined;

    let valueNode: React.ReactNode;
    if (isTemplateBoolean) {
      valueNode = <TemplateAttributeValue value={value} type={attributeTypeMeta} locale={locale} />;
    } else if (isTemplateAttribute) {
      valueNode = markText(formatTemplateAttributeValue(value, attributeTypeMeta, locale), options?.keyword);
    } else {
      valueNode = markText(value, options?.keyword);
    }

    return (
      <p key={key} className={`flex items-center gap-1 text-sm ${options?.isBold ? 'font-bold' : ''}`}>
        {label}: {valueNode}
      </p>
    );
  });
};

// Helper function to extract dimensions (height, width, length) from attributes
const extractDimensions = (attributes: Record<string, string>) => {
  const height = attributes['height'];
  const width = attributes['width'];
  const length = attributes['length'];

  if (height || width || length) {
    const dimensions = [];
    if (height) dimensions.push(`H: ${formatAttributeKey(height)}`);
    if (width) dimensions.push(`W: ${formatAttributeKey(width)}`);
    if (length) dimensions.push(`L: ${formatAttributeKey(length)}`);

    // Todo: Get unit from product
    return dimensions.length > 0 ? dimensions.join(' ') + ' cm' : null;
  }

  return null;
};

export function ProductTileFlyOut({ product, onProductClick, keyword }: ProductTileProps) {
  const t = useTranslations('product');
  const locale = useLocale();
  const { l10n, l10nOrEmpty } = useL10n();
  const [image] = product.images || [];
  const clickable_id = clearMarkHighlights(product.id);
  return (
    <Link href={`/product/${clickable_id}`} onClick={onProductClick}>
      <div className="flex">
        {product.images && (
          <div className="mr-3 bg-surface-image-background w-[100px] h-[144px] rounded-tl-md rounded-br-md flex align-center justify-center flex-shrink-0">
            {image ? (
              <Image
                className="object-contain"
                src={image?.url}
                height={90}
                width={90}
                alt={l10n(image?.altText || '') || ''}
              />
            ) : (
              <Image
                className="object-contain"
                src={'/images/no_image_alt.png'}
                height={90}
                width={90}
                alt={l10n(product.name) || ''}
              />
            )}
          </div>
        )}
        <div>
          <p className="text-sm text-text-body h-[15px]">
            {markText(
              l10n(
                product.brand?.name || product.specifications?.find((spec) => spec.key === 'manufacturer')?.value || '',
              ),
              keyword,
            )}
          </p>
          <p className="text-md font-headlines text-text-body">{markText(l10n(product.name), keyword)}</p>
          {(() => {
            // TODO make this more dynamic
            // Calculate how many attributes to show in total (max 3)
            const maxTotalAttributes = 3;
            const variantAttributes = product.variantAttributeValues as Record<string, string> | undefined;
            const templateAttributes = product.templateAttributes as Record<string, string> | undefined;

            // Extract dimensions from template attributes if they exist
            const dimensionsLine = templateAttributes ? extractDimensions(templateAttributes) : null;

            // Filtered attrs without height/width/length, preserving Product Templates `attributes[]` order
            const filteredTemplateAttributes = templateAttributes
              ? Object.fromEntries(
                  orderedTemplateAttributeEntries(templateAttributes, product.templateAttributeOrder).filter(
                    ([key]) => !['height', 'width', 'length'].includes(key),
                  ),
                )
              : undefined;

            // Count variant attributes (if any)
            const variantCount = variantAttributes ? Object.keys(variantAttributes).length : 0;
            // Calculate how many template attributes we can show (excluding dimensions which will be shown separately)
            const templateCount = Math.max(0, maxTotalAttributes - variantCount - (dimensionsLine ? 1 : 0));

            // Extract unlabelled specifications from the normalized suggest specs to show values directly.
            // l10nOrEmpty() returns '' (not the L10N_MISSING_LABEL '-' sentinel) when a locale is
            // missing, so unlabelled specs are correctly detected and '-' placeholders never leak in.
            const specsWithoutLabel =
              product.specifications
                ?.filter((spec) => !l10nOrEmpty(spec.label) && l10nOrEmpty(spec.value))
                ?.map((spec) => l10nOrEmpty(spec.value)) || [];

            return (
              <>
                {variantAttributes &&
                  renderAttributes(
                    variantAttributes,
                    t as (key: ProductAttributeKey, opts?: { defaultValue?: string }) => string,
                    'productVariantAttributes',
                    {
                      maxItems: Math.min(maxTotalAttributes, variantCount),
                      keyword,
                    },
                  )}
                {specsWithoutLabel.slice(0, 3).map((val, idx) => (
                  <p key={`spec-${idx}`} className="text-sm text-text-muted">
                    {markText(val, keyword)}
                  </p>
                ))}
                {dimensionsLine && <p className="text-sm">{markText(dimensionsLine, keyword)}</p>}
                {filteredTemplateAttributes &&
                  Object.keys(filteredTemplateAttributes).length > 0 &&
                  templateCount > 0 &&
                  renderAttributes(
                    filteredTemplateAttributes,
                    t as (key: ProductAttributeKey, opts?: { defaultValue?: string }) => string,
                    'productTemplateAttributes',
                    {
                      maxItems: templateCount,
                      keyword,
                      locale,
                      templateAttributeLabels: product.templateAttributeLabels,
                      templateAttributeTypes: product.templateAttributeTypes,
                      l10n,
                    },
                  )}
              </>
            );
          })()}
          <p className="text-md mt-2 font-headlines font-bold">
            {product.price && formatCurrency(product.price.amount, product.price.currency)}
          </p>
        </div>
      </div>
    </Link>
  );
}
