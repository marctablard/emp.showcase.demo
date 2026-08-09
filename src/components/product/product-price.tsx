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

/**
 * Assemble Intl currency parts into the Figma split (large integer+decimal, small fraction).
 * Locales like `de` emit multiple `integer` segments plus `group` separators for ≥1000 —
 * mapping each integer alone (and dropping `group`) mangled 1071 into "1.71".
 */
function buildStyledCurrencyParts(parts: Intl.NumberFormatPart[], notAvailableLabel: string): React.ReactNode[] {
  if (parts.length === 0) {
    return [<>{notAvailableLabel}</>];
  }

  const nodes: React.ReactNode[] = [];
  let integerWithGroups = '';
  let integerSpanEmitted = false;

  const flushInteger = (decimalValue: string): void => {
    nodes.push(
      <span id="price" key="price-integer" className="text-4xl font-headlines">
        {integerWithGroups}
        {decimalValue}
      </span>,
    );
    integerWithGroups = '';
    integerSpanEmitted = true;
  };

  parts.forEach((part) => {
    if (part.type === 'integer' || part.type === 'group') {
      integerWithGroups += part.value;
      return;
    }
    if (part.type === 'decimal') {
      flushInteger(part.value);
      return;
    }
    if (part.type === 'fraction') {
      if (!integerSpanEmitted && integerWithGroups) {
        flushInteger('.');
      }
      nodes.push(
        <span key="price-fraction" className="text-2xl align-top font-headlines">
          {part.value}
        </span>,
      );
      return;
    }
    if (part.type === 'currency') {
      nodes.push(
        <span id="currency" key="currency" className="text-4xl font-headlines">
          {part.value}
        </span>,
      );
      return;
    }
    if (part.type === 'literal') {
      nodes.push(<span key={`literal-${part.type}-${part.value}-${nodes.length}`}>{part.value}</span>);
    }
  });

  if (integerWithGroups) {
    flushInteger('');
  }

  return nodes;
}

export function ProductPriceComponent({ price, isAddToCartBar }: Readonly<ProductPriceProps>) {
  const t = useTranslations('product.price');
  const { ready: syncReady } = useGlobalSyncReady();

  if (price === null) {
    return null;
  }

  // Net-first (COP-6056 / B2B): large figure is always net; gross stays in small print.
  // Figma may still show gross-first — Jira requirements win unless a ticket explicitly overrides.
  const displayAmount = resolveNetDisplayAmount(price);
  const parts = formatCurrencyToParts(displayAmount, price.currency);
  const priceFragment = buildStyledCurrencyParts(parts, t('notAvailable'));

  const hasDiscount = price.discountPercentage > 0;
  const showListPrice = price.originalAmount != null && price.originalAmount > price.amount;
  const grossAmount = resolveGrossDisplayAmount(price);

  const taxSmallPrint =
    price.tax == null || grossAmount == null ? null : (
      <>
        {t('plusTax', { taxRate: price.tax.taxRate })} / {formatCurrency(grossAmount, price.currency)} {t('gross')}
      </>
    );

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

/** Net amount for the primary (large) figure — B2B default. */
function resolveNetDisplayAmount(price: ProductPrice): number {
  if (price.tax?.netValue != null) {
    return price.tax.netValue;
  }
  return price.amount;
}

/** Gross amount for secondary small print; null when tax data is unavailable. */
function resolveGrossDisplayAmount(price: ProductPrice): number | null {
  if (price.tax?.grossValue != null) {
    return price.tax.grossValue;
  }
  if (price.includesTax === true) {
    return price.amount;
  }
  return null;
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
