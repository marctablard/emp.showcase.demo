'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { HighlightedText } from '@/components/quick-order/highlighted-text';
import { Checkbox } from '@/components/ui/checkbox';
import { QuantityStepper } from '@/components/ui/molecules/quantity-stepper';
import { useL10n } from '@/hooks/useL10n';
import { cn, formatCurrency } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';

function stripHighlightMarkup(value: string | undefined): string {
  return (value ?? '').replace(/<[^>]+>/g, '').trim();
}

export interface QuoteAddProductResultRowProps {
  product: Product;
  selected: boolean;
  quantity: number;
  pricesLoading: boolean;
  disabled: boolean;
  selectLabel: string;
  onToggleSelected: () => void;
  onQuantityChange: (quantity: number) => void;
}

export function QuoteAddProductResultRow({
  product,
  selected,
  quantity,
  pricesLoading,
  disabled,
  selectLabel,
  onToggleSelected,
  onQuantityChange,
}: QuoteAddProductResultRowProps) {
  const tCart = useTranslations('cart');
  const { l10n } = useL10n();

  const image = product.images?.[0];
  const brandName = l10n(product.brand?.name || '');
  const productName = l10n(product.name);
  const plainProductName = stripHighlightMarkup(productName);
  const itemNumber = product.sku || product.id;

  return (
    <div
      className={cn(
        'group rounded-md border p-4 transition-all duration-200',
        selected
          ? 'border-border-action bg-surface-action-hover-2 shadow-sm'
          : 'border-border-primary bg-surface-page hover:border-border-action-hover hover:shadow-sm',
      )}
      data-testid={`quote-add-products-result-${product.id}`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-4">
          <Checkbox
            checked={selected}
            onCheckedChange={() => onToggleSelected()}
            aria-label={selectLabel}
            disabled={disabled}
            className="mt-1"
            data-testid={`quote-add-products-select-${product.id}`}
          />

          <button
            type="button"
            className="flex min-w-0 flex-1 items-start gap-4 text-left"
            onClick={onToggleSelected}
            disabled={disabled}
          >
            <div className="flex h-[65px] w-[100px] flex-shrink-0 items-center justify-center overflow-hidden rounded-ss-md rounded-ee-md bg-surface-image-background">
              {image?.url ? (
                <Image
                  src={image.url}
                  alt={stripHighlightMarkup(l10n(image.altText || '')) || plainProductName}
                  width={100}
                  height={65}
                  className="h-[65px] w-[100px] object-contain"
                />
              ) : (
                <Image
                  src="/images/no_image_alt.png"
                  alt={plainProductName}
                  width={100}
                  height={65}
                  className="object-contain"
                />
              )}
            </div>

            <div className="min-w-0 flex-1 py-0.5">
              {brandName && (
                <p className="truncate text-sm text-text-placeholders">
                  <HighlightedText text={brandName} />
                </p>
              )}
              <p className="line-clamp-2 text-base font-headlines font-bold text-text-body">
                <HighlightedText text={productName || ''} />
              </p>
              <p className="mt-0.5 text-sm text-text-placeholders">
                {tCart('itemNumber')}: {itemNumber}
              </p>
            </div>
          </button>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-border-primary pt-4 sm:w-auto sm:flex-shrink-0 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:pt-0 sm:pl-2">
          <div className="min-w-[100px] text-left sm:text-right">
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-text-placeholders sm:hidden">
              {tCart('price')}
            </p>
            {pricesLoading ? (
              <div className="space-y-1">
                <div className="h-3 w-16 animate-pulse rounded bg-surface-secondary sm:ms-auto" />
                <div className="h-5 w-20 animate-pulse rounded bg-surface-secondary sm:ms-auto" />
              </div>
            ) : (
              product.price && (
                <div className={cn('transition-opacity', !selected && 'opacity-60')}>
                  {product.price.originalAmount && product.price.originalAmount > product.price.amount && (
                    <p className="text-sm text-text-error line-through">
                      {formatCurrency(product.price.originalAmount, product.price.currency)}
                    </p>
                  )}
                  <p className="text-base font-bold font-headlines text-text-body">
                    {formatCurrency(product.price.tax?.netValue ?? product.price.amount, product.price.currency)}
                  </p>
                  {product.price.tax?.netValue != null && (
                    <span className="text-xs text-text-on-disabled">
                      {tCart('gross')}
                      {formatCurrency(product.price.tax.grossValue, product.price.currency)}
                    </span>
                  )}
                </div>
              )
            )}
          </div>

          <div
            className={cn('w-fit transition-opacity', !selected && 'pointer-events-none opacity-40')}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <p className="mb-1 text-xs font-bold uppercase tracking-wide text-text-placeholders sm:hidden">
              {tCart('qty')}
            </p>
            <QuantityStepper
              value={quantity}
              onChange={onQuantityChange}
              disabled={!selected || disabled}
              size="sm"
              min={1}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
