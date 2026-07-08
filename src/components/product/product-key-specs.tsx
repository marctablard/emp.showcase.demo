'use client';

import { useTranslations } from 'next-intl';
import { Copy } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { H2 } from '@/components/ui/h';
import { useL10n } from '@/hooks/useL10n';
import { type ProductTemplateAttributeKey, dk } from '@/i18n/dynamic-key';
import { resolveProductVariantAttributeLabel } from '@/lib/product/variant-attribute-label';
import { cn } from '@/lib/utils';
import type { Product, ProductVariantAttribute } from '@/platform/services/model/product';

interface ProductKeySpecsProps {
  product: Product;
  className?: string;
  onScrollToTechnicalInfo?: () => void;
}

export function ProductKeySpecs({ product, className, onScrollToTechnicalInfo }: ProductKeySpecsProps) {
  const t = useTranslations('product');
  const { l10n } = useL10n();

  const hasSpecs = product.variantAttributes?.length || Object.keys(product.templateAttributes || {}).length;
  if (!hasSpecs) {
    return null;
  }

  return (
    <Card
      variant="default"
      rounded="lg"
      shadow="none"
      className={cn('border border-border-primary bg-surface-page p-4 md:p-6 gap-4', className)}
    >
      <CardContent className="p-0">
        <H2 variant="h6" className="mb-4 text-base font-headlines">
          {t('keySpecs')}
        </H2>
        <dl className="grid grid-cols-1 gap-x-8 gap-y-3 sm:grid-cols-2">
          {product.variantAttributes?.map((attribute: ProductVariantAttribute) => (
            <div key={attribute.key} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-text-placeholders">
                {resolveProductVariantAttributeLabel(attribute, t, l10n)}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-text-headings">
                {l10n(product.variantAttributeValues?.[attribute.key] ?? '')}
              </dd>
            </div>
          ))}
          {Object.keys(product.templateAttributes || {}).map((attribute: string) => (
            <div key={attribute} className="min-w-0">
              <dt className="text-xs uppercase tracking-wide text-text-placeholders">
                {t(dk<ProductTemplateAttributeKey>(`filters.mixins.productTemplateAttributes.${attribute}`), {
                  defaultValue: attribute,
                })}
              </dt>
              <dd className="mt-0.5 text-sm font-medium text-text-headings">
                {l10n(product.templateAttributes?.[attribute] ?? '')}
              </dd>
            </div>
          ))}
        </dl>

        {product.groupedSpecifications?.length ? (
          <button
            type="button"
            onClick={onScrollToTechnicalInfo}
            className="mt-5 text-sm font-medium text-text-action hover:text-text-action-hover"
          >
            {t('more')}
          </button>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border-primary pt-4">
          <span className="text-xs uppercase tracking-wide text-text-placeholders">{t('itemNumber')}</span>
          <span className="inline-flex items-center gap-2 rounded border border-border-primary bg-surface-disabled px-3 py-1.5 text-sm font-medium text-text-headings">
            {product.sku || product.id}
            <Copy className="h-3.5 w-3.5 text-text-placeholders" aria-label={t('copy')} />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
