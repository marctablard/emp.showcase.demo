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
  /** Current PDP quantity — selects the active tier range on the Your Price label. */
  quantity?: number;
}

interface TierItemRange {
  min: number;
  max: number | null;
}

type ProductPriceTranslations = ReturnType<typeof useTranslations<'product.price'>>;

/** Same min/max as `buildTierDisplayRows` in product-tier-prices — current tier only. */
function resolveCurrentTierItemRange(price: ProductPrice, quantity?: number): TierItemRange | null {
  const tiers = price.tierValues;
  // A single "1+" row is a basic price, not a tier schedule. The tier table uses the same cutoff.
  if (!tiers || tiers.length <= 1) {
    return null;
  }

  const activeQuantity =
    typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : price.quantity?.quantity;
  if (typeof activeQuantity !== 'number' || !Number.isFinite(activeQuantity)) {
    return null;
  }

  const sorted = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity);
  for (let index = 0; index < sorted.length; index += 1) {
    const tier = sorted[index];
    const nextMin = sorted[index + 1]?.minQuantity;
    const isActive = activeQuantity >= tier.minQuantity && (nextMin == null || activeQuantity < nextMin);
    if (!isActive) {
      continue;
    }
    const min = Math.max(tier.minQuantity, 1);
    const max = nextMin == null ? null : Math.max(nextMin - 1, min);
    return { min, max };
  }

  return null;
}

function resolveYourPriceLabel(t: ProductPriceTranslations, range: TierItemRange | null): string {
  if (range == null) {
    return t('yourPrice');
  }
  if (range.max == null) {
    return t('yourPriceItemsFrom', { min: range.min });
  }
  return t('yourPriceItemsRange', { min: range.min, max: range.max });
}

function resolveForItemsCaption(
  t: ProductPriceTranslations,
  amount: number,
  currency: string,
  range: TierItemRange | null,
): string | null {
  if (range == null) {
    return null;
  }
  const formattedAmount = formatCurrency(amount, currency);
  if (range.max == null) {
    return t('amountForItemsFrom', { amount: formattedAmount, min: range.min });
  }
  return t('amountForItemsRange', { amount: formattedAmount, min: range.min, max: range.max });
}

/**
 * Figma Discount Info column is 200px at the default 16px root (`12830:188985`).
 * That width is rem-based and may grow (`max-content`) because the label type is `0.75rem`.
 * A fixed `200px` box lets "Discount" paint over "List price" as soon as the root font
 * (or the phrase) is wider than 200px — overflow stays visible.
 */
const PRICE_LABEL_GRID_CLASS = 'grid-cols-[minmax(12.5rem,max-content)_auto]';

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
  yourPriceLabel,
  t,
}: Readonly<{
  price: ProductPrice;
  priceFragment: React.ReactNode;
  taxSmallPrintText: string | null;
  syncReady: boolean;
  yourPriceLabel: string;
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
          <span className="shrink-0 text-sm font-bold">{yourPriceLabel}</span>
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

export function ProductPriceComponent({ price, isAddToCartBar, quantity }: Readonly<ProductPriceProps>) {
  const t = useTranslations('product.price');
  const { ready: syncReady } = useGlobalSyncReady();

  if (price === null) {
    return null;
  }

  // Net-first (B2B): large figure is always net; gross stays in small print.
  // Figma may still show gross-first — Jira requirements win unless a ticket explicitly overrides.
  const displayAmount = resolveNetDisplayAmount(price);
  const hasListContext = typeof price.originalAmount === 'number' && price.originalAmount > 0;
  if (!Number.isFinite(displayAmount) || displayAmount < 0 || (displayAmount === 0 && !hasListContext)) {
    return <ProductPriceUnavailable />;
  }
  const partSizes = isAddToCartBar ? CURRENCY_PART_SIZES.addToCartBar : CURRENCY_PART_SIZES.default;
  const parts = formatCurrencyToParts(displayAmount, price.currency);
  const priceFragment = buildStyledCurrencyParts(parts, t('notAvailable'), partSizes);
  const taxSmallPrintText = resolveTaxSmallPrintText(price, t);
  const currentTierRange = resolveCurrentTierItemRange(price, quantity);
  const yourPriceLabel = resolveYourPriceLabel(t, currentTierRange);
  const forItemsCaption = resolveForItemsCaption(t, displayAmount, price.currency, currentTierRange);

  if (isAddToCartBar) {
    return (
      <AddToCartBarPrice
        price={price}
        priceFragment={priceFragment}
        taxSmallPrintText={taxSmallPrintText}
        syncReady={syncReady}
        yourPriceLabel={yourPriceLabel}
        t={t}
      />
    );
  }

  const hasDiscount = price.discountPercentage > 0;
  const showListPrice = price.originalAmount != null && price.originalAmount > price.amount;

  return (
    <div
      className={cn('flex flex-col gap-0 transition-opacity', !syncReady && 'opacity-60')}
      data-testid="product-price"
      data-product-currency={price.currency}
      aria-busy={!syncReady || undefined}
    >
      <div
        className={cn('grid w-full items-end gap-x-2', showListPrice && PRICE_LABEL_GRID_CLASS)}
        data-testid="product-price-labels"
      >
        <div className="flex items-center gap-1 whitespace-nowrap">
          <span className="shrink-0 text-sm font-bold">{yourPriceLabel}</span>
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
        {showListPrice ? <span className="whitespace-nowrap text-sm font-bold">{t('listPrice')}</span> : null}
        <div
          className="whitespace-nowrap font-bold font-headlines text-text-headings"
          data-testid="product-price-amounts"
        >
          {priceFragment}
        </div>
        {showListPrice && price.originalAmount != null ? (
          <div className="line-through whitespace-nowrap text-lg text-text-on-disabled">
            {formatCurrency(price.originalAmount, price.currency)}
          </div>
        ) : null}
      </div>
      {forItemsCaption ? (
        <div className="text-sm text-text-body" data-testid="product-price-tier-caption">
          {forItemsCaption}
        </div>
      ) : null}

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
