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

interface CurrencyPartSizeClasses {
  integer: string;
  fraction: string;
  currency: string;
}

/** PDP: Desktop/heading/h4 integer + currency; bar strip: h5/h6 per Figma `2504:75401`. */
const CURRENCY_PART_SIZES = {
  default: {
    integer: 'text-4xl font-headlines',
    fraction: 'text-2xl align-top font-headlines',
    currency: 'text-4xl font-headlines',
  },
  addToCartBar: {
    integer: 'text-3xl font-headlines',
    fraction: 'text-2xl align-top font-headlines',
    currency: 'text-2xl font-headlines',
  },
} as const satisfies Record<string, CurrencyPartSizeClasses>;

/**
 * Assemble Intl currency parts into the Figma split (large integer+decimal, small fraction).
 * Locales like `de` emit multiple `integer` segments plus `group` separators for ≥1000 —
 * mapping each integer alone (and dropping `group`) mangled 1071 into "1.71".
 */
function buildStyledCurrencyParts(
  parts: Intl.NumberFormatPart[],
  notAvailableLabel: string,
  sizes: CurrencyPartSizeClasses,
): React.ReactNode[] {
  if (parts.length === 0) {
    return [<>{notAvailableLabel}</>];
  }

  const nodes: React.ReactNode[] = [];
  let integerWithGroups = '';
  let integerSpanEmitted = false;

  const flushInteger = (decimalValue: string): void => {
    nodes.push(
      <span id="price" key="price-integer" className={sizes.integer}>
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
        <span key="price-fraction" className={sizes.fraction}>
          {part.value}
        </span>,
      );
      return;
    }
    if (part.type === 'currency') {
      nodes.push(
        <span id="currency" key="currency" className={sizes.currency}>
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

function resolveTaxSmallPrintText(
  price: ProductPrice,
  t: ReturnType<typeof useTranslations<'product.price'>>,
): string | null {
  const grossAmount = resolveGrossDisplayAmount(price);
  if (price.tax == null || grossAmount == null) {
    return null;
  }
  return `${t('plusTax', { taxRate: price.tax.taxRate })} / ${formatCurrency(grossAmount, price.currency)} ${t('gross')}`;
}

/** Sticky strip layout (Figma `2504:75401`) — kept separate so ProductPriceComponent stays under Sonar complexity. */
function AddToCartBarPrice({
  price,
  priceFragment,
  taxSmallPrintText,
  syncReady,
  t,
}: Readonly<{
  price: ProductPrice;
  priceFragment: React.ReactNode;
  taxSmallPrintText: string | null;
  syncReady: boolean;
  t: ReturnType<typeof useTranslations<'product.price'>>;
}>): React.ReactElement {
  const hasDiscount = price.discountPercentage > 0;
  const showListPrice = price.originalAmount != null && price.originalAmount > price.amount;

  return (
    <div
      className={cn(
        // Figma `2504:75401` — two columns, gap-4. No `@container`: inline-size containment +
        // max-w-full collapses this block to 0 width inside a min-w-0/overflow-hidden flex parent.
        'flex w-max shrink-0 items-start gap-4 transition-opacity',
        !syncReady && 'opacity-60',
      )}
      data-testid="product-price"
      data-product-currency={price.currency}
      aria-busy={!syncReady || undefined}
    >
      <div className="flex shrink-0 flex-col items-start" data-testid="product-price-current-column">
        <div className="flex items-center gap-1" data-testid="product-price-labels">
          <span className="shrink-0 text-sm font-bold">{t('yourPrice')}</span>
          {hasDiscount ? (
            <>
              <span className="shrink-0 text-sm">, {t('including')}</span>
              <Badge variant="sale" rounded="none" fontWeight="bold" className="shrink-0 rounded-sm px-1 py-0">
                -{Math.round(price.discountPercentage)}%
              </Badge>
              <span className="shrink-0 text-sm">{t('discount')}</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-2" data-testid="product-price-amounts">
          <div className="shrink-0 font-bold font-headlines text-text-on-action">{priceFragment}</div>
          {taxSmallPrintText ? (
            <div className="shrink-0 whitespace-nowrap text-sm text-text-on-action" data-testid="product-price-tax">
              {taxSmallPrintText}
            </div>
          ) : null}
        </div>
      </div>
      {showListPrice && price.originalAmount != null ? (
        <div className="flex shrink-0 flex-col items-start whitespace-nowrap" data-testid="product-price-list-column">
          <span className="h-5 text-sm font-bold">{t('listPrice')}</span>
          <div className="line-through whitespace-nowrap text-base text-text-on-action">
            {formatCurrency(price.originalAmount, price.currency)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function ProductPriceComponent({ price, isAddToCartBar }: Readonly<ProductPriceProps>) {
  const t = useTranslations('product.price');
  const { ready: syncReady } = useGlobalSyncReady();

  if (price === null) {
    return null;
  }

  // Net-first (B2B): large figure is always net; gross stays in small print.
  // Figma may still show gross-first — Jira requirements win unless a ticket explicitly overrides.
  const displayAmount = resolveNetDisplayAmount(price);
  if (!Number.isFinite(displayAmount) || displayAmount <= 0) {
    return <ProductPriceUnavailable />;
  }
  const partSizes = isAddToCartBar ? CURRENCY_PART_SIZES.addToCartBar : CURRENCY_PART_SIZES.default;
  const parts = formatCurrencyToParts(displayAmount, price.currency);
  const priceFragment = buildStyledCurrencyParts(parts, t('notAvailable'), partSizes);
  const taxSmallPrintText = resolveTaxSmallPrintText(price, t);

  if (isAddToCartBar) {
    return (
      <AddToCartBarPrice
        price={price}
        priceFragment={priceFragment}
        taxSmallPrintText={taxSmallPrintText}
        syncReady={syncReady}
        t={t}
      />
    );
  }

  const hasDiscount = price.discountPercentage > 0;
  const showListPrice = price.originalAmount != null && price.originalAmount > price.amount;

  const discountInfo = (
    <div className={cn('flex items-center gap-1', showListPrice && PRICE_LEFT_COLUMN_CLASS)}>
      <span className="shrink-0 text-sm font-bold">{t('yourPrice')}</span>
      {hasDiscount && (
        <>
          <span className="shrink-0 text-sm">, {t('including')}</span>
          <Badge variant="sale" rounded="none" fontWeight="bold" className="shrink-0 rounded-sm px-1 py-0">
            -{Math.round(price.discountPercentage)}%
          </Badge>
          <span className="text-sm">{t('discount')}</span>
        </>
      )}
    </div>
  );

  const currentPriceFigure = (
    <div
      className={cn('font-bold font-headlines shrink-0 text-text-headings', showListPrice && PRICE_LEFT_COLUMN_CLASS)}
    >
      {priceFragment}
    </div>
  );

  const listPriceAmount =
    showListPrice && price.originalAmount != null ? (
      <div className="line-through whitespace-nowrap text-lg text-text-on-disabled">
        {formatCurrency(price.originalAmount, price.currency)}
      </div>
    ) : null;

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
          {currentPriceFigure}
          {listPriceAmount}
        </div>
      </div>

      {taxSmallPrintText ? <div className="text-sm mb-2 text-text-on-disabled">{taxSmallPrintText}</div> : null}

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

function isPositiveMoney(value: number | undefined | null): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/** Net amount for the primary (large) figure — B2B default. */
function resolveNetDisplayAmount(price: ProductPrice): number {
  if (isPositiveMoney(price.tax?.netValue)) {
    return price.tax.netValue;
  }
  return price.amount;
}

/** Gross amount for secondary small print; null when tax data is unavailable. */
function resolveGrossDisplayAmount(price: ProductPrice): number | null {
  if (isPositiveMoney(price.tax?.grossValue)) {
    return price.tax.grossValue;
  }
  if (price.includesTax === true && isPositiveMoney(price.amount)) {
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
