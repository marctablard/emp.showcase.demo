'use client';

import type { JSX } from 'react';
import { useTranslations } from 'next-intl';
import { cn, formatCurrency } from '@/lib/utils';
import type { ProductPrice } from '@/platform/services/model/price';
import { PRICE_MODEL_TYPE } from '@/platform/services/model/price/price-model-type';

export interface ProductTierPricesProps {
  price: ProductPrice;
  /** Current PDP quantity — selects the active tier row. */
  quantity: number;
  className?: string;
}

interface TierDisplayRow {
  id: string;
  minQuantity: number;
  displayMin: number;
  displayMax: number | null;
  unitPrice: number;
  net: number;
  gross: number;
  isActive: boolean;
}

function resolveTierNetGross(tierUnitPrice: number, price: ProductPrice): { net: number; gross: number } {
  const taxRate = price.tax?.taxRate;
  if (taxRate == null || !Number.isFinite(taxRate)) {
    return { net: tierUnitPrice, gross: tierUnitPrice };
  }

  if (price.includesTax === true) {
    return {
      net: tierUnitPrice / (1 + taxRate / 100),
      gross: tierUnitPrice,
    };
  }

  return {
    net: tierUnitPrice,
    gross: tierUnitPrice * (1 + taxRate / 100),
  };
}

/**
 * The matched-price API converts base/effective/total amounts into the requested session
 * currency, but `tierValues` stay in the price list's original currency and carry no
 * currency of their own (`EmporixTierValue` = id + priceValue). When the base tier no
 * longer matches the price's original amount, the tier amounts belong to another currency —
 * rendering them would label foreign amounts with the session's currency symbol
 * (e.g. EUR 130.00 shown as $130.00 next to a correct $115.27 base price).
 */
export function tierValuesMatchPriceCurrency(price: ProductPrice): boolean {
  const tiers = price.tierValues;
  if (!tiers || tiers.length === 0) {
    return false;
  }
  const base = [...tiers].sort((a, b) => a.minQuantity - b.minQuantity)[0];
  if (!Number.isFinite(base.price) || !Number.isFinite(price.originalAmount) || price.originalAmount <= 0) {
    return false;
  }
  return Math.abs(base.price - price.originalAmount) / price.originalAmount < 0.005;
}

function buildTierDisplayRows(price: ProductPrice, quantity: number): TierDisplayRow[] {
  const sorted = [...price.tierValues].sort((a, b) => a.minQuantity - b.minQuantity);
  if (sorted.length === 0) {
    return [];
  }

  return sorted.map((tier, index) => {
    const nextMin = sorted[index + 1]?.minQuantity;
    const displayMin = Math.max(tier.minQuantity, 1);
    const displayMax = nextMin == null ? null : Math.max(nextMin - 1, displayMin);
    const { net, gross } = resolveTierNetGross(tier.price, price);
    const isActive = quantity >= tier.minQuantity && (nextMin == null || quantity < nextMin);

    return {
      id: tier.id,
      minQuantity: tier.minQuantity,
      displayMin,
      displayMax,
      unitPrice: tier.price,
      net,
      gross,
      isActive,
    };
  });
}

type ProductPriceTranslations = ReturnType<typeof useTranslations<'product.price'>>;

function resolveUnitSuffix(
  t: ProductPriceTranslations,
  priceModelType: ProductPrice['priceModelType'],
  row: TierDisplayRow,
): string {
  if (priceModelType === PRICE_MODEL_TYPE.TIERED) {
    return row.displayMax == null
      ? t('tiers.forUnitsFrom', { min: row.displayMin })
      : t('tiers.forUnitsRange', { min: row.displayMin, max: row.displayMax });
  }

  // VOLUME (and unknown/BASIC fallback): unit price applies to every unit at that threshold.
  return t('tiers.forEachUnit');
}

/**
 * Figma Tier Prices Table (`12799:113152`) — two columns (Quantity | Price per unit).
 * Net-first: large unit figure is net; gross stays in the smaller VAT line.
 * Trailing unit copy differs by price model (TIERED range vs VOLUME for-each-unit).
 */
export function ProductTierPrices({
  price,
  quantity,
  className,
}: Readonly<ProductTierPricesProps>): JSX.Element | null {
  const t = useTranslations('product.price');
  const rows = buildTierDisplayRows(price, quantity);

  // Single-tier (e.g. "Buy 1+") is not useful as a table — only show true volume breaks.
  if (rows.length <= 1) {
    return null;
  }

  // Unconverted foreign-currency tier amounts must not render (see tierValuesMatchPriceCurrency).
  if (!tierValuesMatchPriceCurrency(price)) {
    return null;
  }

  const taxRate = price.tax?.taxRate;

  return (
    <div className={cn('mt-6 w-full', className)} data-testid="product-tier-prices">
      <div className="flex w-full items-center border-b border-border-primary">
        <div className="flex h-11 w-[200px] shrink-0 items-center px-4 py-3">
          <p className="font-headlines text-2xl font-bold text-text-headings">{t('tiers.quantity')}</p>
        </div>
        <div className="flex h-11 min-w-0 flex-1 items-center px-2 py-3">
          <p className="font-headlines text-2xl font-bold text-text-headings">{t('tiers.pricePerUnit')}</p>
        </div>
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          className={cn(
            'flex w-full items-stretch border-b border-border-primary',
            row.isActive && 'bg-surface-information',
          )}
          data-testid="product-tier-prices-row"
          data-tier-active={row.isActive ? 'true' : 'false'}
        >
          {row.isActive ? (
            <div className="flex shrink-0 self-stretch bg-surface-information">
              <div className="w-2 shrink-0 self-stretch rounded-br-sm bg-surface-action" aria-hidden="true" />
            </div>
          ) : null}

          <div
            className={cn(
              'flex w-[200px] shrink-0 items-start border-border-primary py-2',
              row.isActive ? 'w-[192px] pl-2 pr-4' : 'px-4',
            )}
          >
            <p className={cn('text-base text-text-body', row.isActive ? 'font-bold' : 'font-normal')}>
              {row.displayMax == null
                ? t('tiers.buyFrom', { min: row.displayMin })
                : t('tiers.buyRange', { min: row.displayMin, max: row.displayMax })}
            </p>
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-start py-2 pl-2">
            <p className={cn('text-base text-text-body', row.isActive ? 'font-bold' : 'font-normal')}>
              <span>{formatCurrency(row.net, price.currency)}</span>
              {taxRate == null ? null : (
                <span className="text-xs font-bold">
                  {' '}
                  ({t('plusTax', { taxRate })} / {formatCurrency(row.gross, price.currency)} {t('gross')})
                </span>
              )}{' '}
              <span data-testid="product-tier-prices-unit-suffix">
                {resolveUnitSuffix(t, price.priceModelType, row)}
              </span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
