import React from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { type ProductAttributeKey, dk } from '@/i18n/dynamic-key';
import { Link } from '@/i18n/navigation';
import { formatCurrency, l10n } from '@/lib/utils';
import { Product } from '@/platform/services/model/product';

interface ProductTileProps {
  product: Product;
  className?: string;
  locale?: string;
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
const markText = (text: string, keyword?: string): React.ReactNode => {
  if (!keyword || !text) return text;

  // Check if the text contains HTML tags like <mark>
  if (text.includes('<mark>')) {
    // Extract content between <mark> tags and make it bold
    const parts = text.split(/<\/?mark>/g);
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
    const parts = text.split(regex);

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
    return text;
  }
};

// Helper function to render product attributes
const renderAttributes = (
  attributes: Record<string, string>,
  t: (key: ProductAttributeKey, opts?: { defaultValue?: string }) => string,
  attributeType: 'productVariantAttributes' | 'productTemplateAttributes',
  maxItems?: number,
  isBold?: boolean,
  keyword?: string,
) => {
  const entries = Object.entries(attributes);
  const limitedEntries = maxItems ? entries.slice(0, maxItems) : entries;

  return limitedEntries.map(([key, value]) => (
    <p key={key} className={`text-sm ${isBold ? 'font-bold' : ''}`}>
      {t(dk<ProductAttributeKey>(`filters.mixins.${attributeType}.${key}`), {
        defaultValue: formatAttributeKey(key),
      })}
      : {markText(value, keyword)}
    </p>
  ));
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

export function ProductTileFlyOut({ product, locale = 'de', onProductClick, keyword }: ProductTileProps) {
  const t = useTranslations('product');
  const [image] = product.images || [];
  const clickable_id = product.id ? product.id.replaceAll(/<\/?mark>/g, '') : '';
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
                alt={l10n(image?.altText || '', locale) || ''}
              />
            ) : (
              <Image
                className="object-contain"
                src={'/images/no_image_alt.png'}
                height={90}
                width={90}
                alt={l10n(product.name, locale) || ''}
              />
            )}
          </div>
        )}
        <div>
          <p className="text-sm text-text-body h-[15px]">
            {markText(
              l10n(
                product.brand?.name || product.specifications?.find((spec) => spec.key === 'manufacturer')?.value || '',
                locale,
              ),
              keyword,
            )}
          </p>
          <p className="text-md font-headlines text-text-body">{markText(l10n(product.name, locale), keyword)}</p>
          {(() => {
            // TODO make this more dynamic
            // Calculate how many attributes to show in total (max 3)
            const maxTotalAttributes = 3;
            const variantAttributes = product.variantAttributeValues as Record<string, string> | undefined;
            const templateAttributes = product.templateAttributes as Record<string, string> | undefined;

            // Extract dimensions from template attributes if they exist
            const dimensionsLine = templateAttributes ? extractDimensions(templateAttributes) : null;

            // Create a filtered template attributes object without height, width, length
            const filteredTemplateAttributes = templateAttributes
              ? Object.fromEntries(
                  Object.entries(templateAttributes).filter(([key]) => !['height', 'width', 'length'].includes(key)),
                )
              : undefined;

            // Count variant attributes (if any)
            const variantCount = variantAttributes ? Object.keys(variantAttributes).length : 0;
            // Calculate how many template attributes we can show (excluding dimensions which will be shown separately)
            const templateCount = Math.max(0, maxTotalAttributes - variantCount - (dimensionsLine ? 1 : 0));

            return (
              <>
                {variantAttributes &&
                  renderAttributes(
                    variantAttributes,
                    t as (key: ProductAttributeKey, opts?: { defaultValue?: string }) => string,
                    'productVariantAttributes',
                    Math.min(maxTotalAttributes, variantCount),
                    false,
                    keyword,
                  )}
                {dimensionsLine && <p className="text-sm">{markText(dimensionsLine, keyword)}</p>}
                {filteredTemplateAttributes &&
                  Object.keys(filteredTemplateAttributes).length > 0 &&
                  templateCount > 0 &&
                  renderAttributes(
                    filteredTemplateAttributes,
                    t as (key: ProductAttributeKey, opts?: { defaultValue?: string }) => string,
                    'productTemplateAttributes',
                    templateCount,
                    false,
                    keyword,
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
