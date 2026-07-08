'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { RotateCcw, ShoppingCart, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Overline } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useVariantConfigurator } from '@/hooks/product/useVariantConfigurator';
import { useSession } from '@/hooks/session/useSession';
import { useL10n } from '@/hooks/useL10n';
import { useRouter } from '@/i18n/navigation';
import { fetchProductAvailability } from '@/lib/client/availability';
import { fetchProductPrice } from '@/lib/client/prices';
import { resolveProductVariantAttributeLabel } from '@/lib/product/variant-attribute-label';
import {
  getVariantAttributeMap,
  isColorAttributeKey,
  isVariantConfiguratorProduct,
} from '@/lib/product/variant-configurator';
import { cn, formatCurrency } from '@/lib/utils';
import type { StockAvailability } from '@/platform/services/model/common';
import type { ProductPrice } from '@/platform/services/model/price';
import type { Product } from '@/platform/services/model/product';
import { getColorValue } from '@/utils/colors';
import ProductAddToCartButton from './product-add-to-cart-button';

export interface ProductVariantConfiguratorProps {
  product: Product;
  className?: string;
}

function getAttributeLabel(
  attribute: NonNullable<Product['variantAttributes']>[number],
  product: Product,
  t: ReturnType<typeof useTranslations<'product'>>,
  l10n: ReturnType<typeof useL10n>['l10n'],
): string {
  return resolveProductVariantAttributeLabel(attribute, t, l10n);
}

function getAttributeLabelByKey(
  attributeDefinitions: Product['variantAttributes'],
  attributeKey: string,
  product: Product,
  t: ReturnType<typeof useTranslations<'product'>>,
  l10n: ReturnType<typeof useL10n>['l10n'],
): string {
  const attribute = attributeDefinitions?.find((item) => item.key === attributeKey);
  if (attribute) {
    return getAttributeLabel(attribute, product, t, l10n);
  }

  const specLabel = product.specifications?.find((spec) => spec.key === attributeKey)?.label;
  if (specLabel) {
    return l10n(specLabel);
  }

  return attributeKey;
}

function getAttributeValueLabel(
  attributeDefinitions: Product['variantAttributes'],
  attributeKey: string,
  valueKey: string,
  l10n: ReturnType<typeof useL10n>['l10n'],
): string {
  const attribute = attributeDefinitions?.find((item) => item.key === attributeKey);
  const value = attribute?.values?.find((item) => item.key === valueKey);
  return value?.name ? l10n(value.name) : valueKey;
}

function VariantConfiguratorRow({
  variant,
  attributeDefinitions,
  isCurrent,
  onSelect,
}: {
  variant: Product;
  attributeDefinitions: NonNullable<Product['variantAttributes']>;
  isCurrent: boolean;
  onSelect: (variantId: string) => void;
}) {
  const t = useTranslations('product');
  const { l10n } = useL10n();
  const { session } = useSession();
  const [price, setPrice] = useState<ProductPrice | null | undefined>(undefined);
  const [availability, setAvailability] = useState<StockAvailability | undefined>(undefined);
  const [quantity, setQuantity] = useState(1);

  const variantAttributes = useMemo(() => getVariantAttributeMap(variant), [variant]);

  useEffect(() => {
    let isCancelled = false;

    const loadRowData = async () => {
      try {
        const [fetchedPrice, fetchedAvailability] = await Promise.all([
          fetchProductPrice(variant.id, undefined, undefined, session?.currency),
          fetchProductAvailability(variant.id),
        ]);

        if (!isCancelled) {
          setPrice(fetchedPrice);
          setAvailability(fetchedAvailability);
        }
      } catch {
        if (!isCancelled) {
          setPrice(null);
          setAvailability(undefined);
        }
      }
    };

    void loadRowData();

    return () => {
      isCancelled = true;
    };
  }, [variant.id, session?.currency]);

  const stockLabel =
    availability === undefined
      ? '…'
      : availability.availableQuantity > 0
        ? String(availability.availableQuantity)
        : t('variantConfigurator.outOfStock');

  const stockClass =
    availability === undefined
      ? 'bg-surface-disabled'
      : !availability.isAvailable || availability.availableQuantity <= 0
        ? 'bg-surface-error'
        : availability.availableQuantity <= 5
          ? 'bg-surface-warning'
          : 'bg-surface-success';

  return (
    <TableRow
      data-state={isCurrent ? 'selected' : undefined}
      className={cn(
        'cursor-pointer text-sm even:bg-surface-disabled/40',
        isCurrent && 'bg-surface-action-hover/10 hover:bg-surface-action-hover/10',
      )}
      onClick={() => onSelect(variant.id)}
    >
      {attributeDefinitions.map((attribute) => (
        <TableCell key={`${variant.id}-${attribute.key}`} className="whitespace-normal">
          {variantAttributes[attribute.key]
            ? getAttributeValueLabel(attributeDefinitions, attribute.key, variantAttributes[attribute.key], l10n)
            : '—'}
        </TableCell>
      ))}
      {attributeDefinitions.length === 0 && (
        <TableCell className="max-w-[240px] whitespace-normal font-medium">{l10n(variant.name)}</TableCell>
      )}
      <TableCell className="font-mono text-xs text-text-placeholders">{variant.sku || variant.id}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className={cn('inline-block h-2 w-2 rounded-full', stockClass)} />
          <span className="text-text-body">{stockLabel}</span>
        </div>
      </TableCell>
      <TableCell className="font-medium">
        {price === undefined
          ? '…'
          : price
            ? formatCurrency(price.amount, price.currency)
            : t('price.priceNotAvailable')}
      </TableCell>
      <TableCell className="w-0 min-w-[220px]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center rounded border border-border-primary">
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-none border-0 shadow-none"
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
              aria-label={t('variantConfigurator.decreaseQuantity')}
            >
              −
            </Button>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
              className="h-8 w-12 rounded-none border-0 border-x border-border-primary px-1 text-center shadow-none"
            />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-none border-0 shadow-none"
              onClick={() => setQuantity((current) => current + 1)}
              aria-label={t('variantConfigurator.increaseQuantity')}
            >
              +
            </Button>
          </div>
          <ProductAddToCartButton
            product={variant}
            price={price}
            availability={availability}
            availabilityLoading={availability === undefined}
            quantity={quantity}
            compact
            className="shrink-0"
          />
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function ProductVariantConfigurator({ product, className }: ProductVariantConfiguratorProps) {
  const t = useTranslations('product');
  const { l10n } = useL10n();
  const router = useRouter();
  const {
    loading,
    attributeDefinitions,
    selectedAttributes,
    filteredVariants,
    setAttributeValue,
    clearAttribute,
    resetSelection,
    getAvailableValuesForAttribute,
  } = useVariantConfigurator(product);

  const configurableAttributeKeys = useMemo(
    () => new Set(attributeDefinitions.map((attribute) => attribute.key)),
    [attributeDefinitions],
  );

  const selectedEntries = Object.entries(selectedAttributes).filter(
    ([key, value]) => value && configurableAttributeKeys.has(key),
  );

  const handleSelectVariant = (variantId: string) => {
    if (variantId !== product.id) {
      router.push(`/product/${variantId}`);
    }
  };

  if (!isVariantConfiguratorProduct(product)) {
    return null;
  }

  return (
    <div className={cn('space-y-8', className)} data-testid="product-variant-configurator">
      <Card variant="default" rounded="lg" shadow="none" className="gap-0 border border-border-primary p-0">
        <CardContent className="p-4 md:p-6">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border-primary pb-4">
            <div>
              <Overline className="text-sm">{t('variantConfigurator.title')}</Overline>
              {!loading && (
                <p className="mt-1 text-sm text-text-placeholders">
                  {t('variantConfigurator.matchingCount', { count: filteredVariants.length })}
                </p>
              )}
            </div>
            <Button type="button" variant="secondary" size="small" onClick={resetSelection}>
              <RotateCcw className="h-4 w-4" />
              {t('variantConfigurator.reset')}
            </Button>
          </div>

          <div className="space-y-5">
            {attributeDefinitions.length === 0 && loading ? (
              <div className="flex items-center gap-2 text-text-placeholders">
                <Spinner variant="sm" color="primary" />
                {t('loadingVariants')}
              </div>
            ) : attributeDefinitions.length > 0 ? (
              attributeDefinitions.map((attribute) => {
                const availableValues = getAvailableValuesForAttribute(attribute.key);
                const isColor = isColorAttributeKey(attribute.key);

                return (
                  <div key={attribute.key} className="space-y-2.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-text-placeholders">
                      {getAttributeLabel(attribute, product, t, l10n)}
                    </p>

                    {isColor ? (
                      <div className="flex flex-wrap gap-2">
                        <style type="text/css">
                          {availableValues.map((attributeValue) => {
                            return `.configurator-color-${attributeValue.key} { background-color: ${getColorValue(attributeValue.key)}; }\n`;
                          })}
                        </style>
                        {availableValues.map((attributeValue) => {
                          const isSelected = selectedAttributes[attribute.key] === attributeValue.key;
                          return (
                            <button
                              type="button"
                              key={attributeValue.key}
                              onClick={() => setAttributeValue(attribute.key, attributeValue.key)}
                              className={cn(
                                'relative h-8 w-8 border transition-colors',
                                isSelected
                                  ? 'border-border-action ring-2 ring-border-action/30'
                                  : 'border-border-primary',
                                `configurator-color-${attributeValue.key}`,
                              )}
                              title={l10n(attributeValue.name || attributeValue.key)}
                              aria-pressed={isSelected}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {availableValues.map((attributeValue) => {
                          const isSelected = selectedAttributes[attribute.key] === attributeValue.key;
                          return (
                            <Button
                              key={attributeValue.key}
                              type="button"
                              size="small"
                              variant={isSelected ? 'primary' : 'secondary'}
                              className={cn(!isSelected && 'bg-surface-page')}
                              onClick={() => setAttributeValue(attribute.key, attributeValue.key)}
                              aria-pressed={isSelected}
                            >
                              {l10n(attributeValue.name || attributeValue.key)}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            ) : null}
          </div>

          {selectedEntries.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border-primary pt-4">
              {selectedEntries.map(([attributeKey, valueKey]) => (
                <Badge key={attributeKey} variant="secondary" className="gap-1 rounded-sm pr-1 font-normal">
                  <span className="text-text-body">
                    {getAttributeLabelByKey(attributeDefinitions, attributeKey, product, t, l10n)}:{' '}
                    <span className="font-medium">
                      {getAttributeValueLabel(attributeDefinitions, attributeKey, valueKey, l10n)}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-surface-disabled"
                    onClick={() => clearAttribute(attributeKey)}
                    aria-label={t('variantConfigurator.removeFilter', {
                      filter: getAttributeLabelByKey(attributeDefinitions, attributeKey, product, t, l10n),
                    })}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Overline className="text-sm">{t('variantConfigurator.availableVariants')}</Overline>

        {loading ? (
          <div className="flex items-center gap-2 py-8 text-text-placeholders">
            <Spinner variant="sm" color="primary" />
            {t('loadingVariants')}
          </div>
        ) : filteredVariants.length === 0 ? (
          <p className="py-8 text-sm text-text-placeholders">{t('variantConfigurator.noMatches')}</p>
        ) : (
          <Card
            variant="default"
            rounded="lg"
            shadow="none"
            className="gap-0 overflow-hidden border border-border-primary p-0"
          >
            <Table>
              <TableHeader>
                <TableRow className="bg-surface-disabled hover:bg-surface-disabled">
                  {attributeDefinitions.map((attribute) => (
                    <TableHead key={attribute.key} className="text-xs uppercase tracking-wide text-text-placeholders">
                      {getAttributeLabel(attribute, product, t, l10n)}
                    </TableHead>
                  ))}
                  {attributeDefinitions.length === 0 && (
                    <TableHead className="text-xs uppercase tracking-wide text-text-placeholders">
                      {t('variantConfigurator.variant')}
                    </TableHead>
                  )}
                  <TableHead className="text-xs uppercase tracking-wide text-text-placeholders">
                    {t('variantConfigurator.code')}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-text-placeholders">
                    {t('variantConfigurator.stock')}
                  </TableHead>
                  <TableHead className="text-xs uppercase tracking-wide text-text-placeholders">
                    {t('variantConfigurator.price')}
                  </TableHead>
                  <TableHead className="w-0 text-xs uppercase tracking-wide text-text-placeholders">
                    <span className="sr-only">{t('addToCart')}</span>
                    <ShoppingCart className="mx-auto h-4 w-4 text-icon-primary" aria-hidden />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVariants.map((variant) => (
                  <VariantConfiguratorRow
                    key={variant.id}
                    variant={variant}
                    attributeDefinitions={attributeDefinitions}
                    isCurrent={variant.id === product.id}
                    onSelect={handleSelectVariant}
                  />
                ))}
              </TableBody>
            </Table>
          </Card>
        )}
      </div>
    </div>
  );
}
