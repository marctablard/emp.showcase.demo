'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useGlobalSyncReady } from '@/hooks/common/useGlobalSyncReady';
import { cn, formatCurrency, formatCurrencyToParts } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';

interface ProductPriceProps {
  price: ProductPrice | null;
  isAddToCartBar?: boolean;
}

/** Figma Discount Info / gross column width (`12830:188985` / `12830:188992`). */
const PRICE_LEFT_COLUMN_CLASS = 'w-[200px] shrink-0';

export function ProductPriceComponent({ price, isAddToCartBar }: ProductPriceProps) {
  const t = useTranslations('product.price');
  const { ready: syncReady } = useGlobalSyncReady();

  if (price === null) {
    return null;
  }

  // Gross-first (D1): when price is net-based, large figure is tax.grossValue.
  const displayAmount = price.tax != null && !price.includesTax ? price.tax.grossValue : price.amount;
  const parts = formatCurrencyToParts(displayAmount, price.currency);
  let priceFragment: React.ReactNode[];
  if (parts.length === 0) {
    priceFragment = [<>{t('notAvailable')}</>];
  } else {
    const decimal = parts.find((part) => part.type === 'decimal')?.value || '.';

    priceFragment = [
      parts.map((part, index) => {
        if (part.type === 'currency') {
          return (
            <span id="currency" key={index} className="text-4xl font-headlines">
              {part.value}
            </span>
          );
        }
        if (part.type === 'literal') {
          return <span key={index}>{part.value}</span>;
        }
        if (part.type === 'integer') {
          return (
            <span id="price" key={index} className="text-4xl font-headlines">
              {Math.floor(Number(part.value))}
              {decimal}
            </span>
          );
        }
        if (part.type === 'fraction') {
          return (
            <span key={index} className="text-2xl align-top font-headlines">
              {part.value}
            </span>
          );
        }
      }),
    ];
  }

  const hasDiscount = price.discountPercentage > 0;
  const showListPrice = price.originalAmount != null && price.originalAmount > price.amount;

  const taxSmallPrint =
    price.tax != null ? (
      <>
        {t('includingTax', { taxRate: price.tax.taxRate })} / {formatCurrency(price.tax.netValue, price.currency)}{' '}
        {t('net')}
      </>
    ) : null;

  const discountInfo = (
    <div className={cn('flex items-center gap-1', showListPrice && PRICE_LEFT_COLUMN_CLASS)}>
      <span className="text-sm font-bold">{t('yourPrice')}</span>
      {hasDiscount && (
        <>
          <span className="text-sm">, {t('including')}</span>
          <Badge variant="sale" rounded="none" fontWeight="bold" className="rounded-sm px-1 py-0">
            -{Math.round(price.discountPercentage)}%
          </Badge>
          <span className="text-sm">{t('discount')}</span>
        </>
      )}
    </div>
  );

  return (
    <div
      className={cn('flex flex-col gap-0 transition-opacity', !syncReady && 'opacity-60')}
      data-testid="product-price"
      data-product-currency={price.currency}
      aria-busy={!syncReady || undefined}
    >
      <div className="flex flex-col items-start w-full">
        <div className="flex items-center gap-2 w-full" data-testid="product-price-labels">
          {discountInfo}
          {showListPrice && <span className="text-sm font-bold flex-1 min-w-0">{t('listPrice')}</span>}
        </div>

        <div className="flex items-end gap-2 w-full" data-testid="product-price-amounts">
          <div
            className={cn(
              'font-bold font-headlines',
              showListPrice && PRICE_LEFT_COLUMN_CLASS,
              isAddToCartBar ? 'text-text-on-action' : 'text-text-headings',
            )}
          >
            {priceFragment}
          </div>
          {showListPrice && (
            <div
              className={cn('line-through text-lg', isAddToCartBar ? 'text-text-on-action' : 'text-text-on-disabled')}
            >
              {formatCurrency(price.originalAmount!, price.currency)}
            </div>
          )}
          {isAddToCartBar && taxSmallPrint}
        </div>
      </div>

      {!isAddToCartBar && taxSmallPrint != null && (
        <div className="text-sm mb-2 text-text-on-disabled">{taxSmallPrint}</div>
      )}

      {/* Wait for a proper styling for List Prices
      {price.tierValues?.length > 0 && (
        <div className="mt-2 space-y-2">
          {price.tierValues.map((tier, index) => (
            <div key={index} className="flex items-center text-sm text-text-placeholders">
              <span className="font-medium mr-2">{tier.minQuantity}+</span>
              <span>${tier.price.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
      */}
    </div>
  );
}

export function ProductPriceSkeleton() {
  return (
    <div className="space-y-2 mb-2" data-testid="product-price" aria-busy="true">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-4 w-40" />
    </div>
  );
}

/** Shown when the price request completed but match-prices returned no row for this product. */
export function ProductPriceUnavailable() {
  const t = useTranslations('product.price');
  return (
    <div
      className="flex flex-col gap-0"
      data-testid="product-price"
      data-product-price-state="unavailable"
      aria-label={t('priceNotAvailable')}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold">{t('yourPrice')}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <div className="font-bold font-headlines text-4xl text-text-headings" aria-hidden>
          -
        </div>
      </div>
    </div>
  );
}
