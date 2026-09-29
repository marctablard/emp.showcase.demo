'use client';

import { useTranslations } from 'next-intl';
import type { CheckoutOrderSummaryBreakdown } from '@/lib/common/checkout-order-summary';
import { formatCurrency } from '@/lib/utils';

function figureTestId(prefix: string, name: string): string {
  return `${prefix}-${name}`;
}

function CheckoutSavingsBadge(props: Readonly<{ amount: number; currency: string; label: string; idPrefix: string }>) {
  return (
    <div className="flex justify-end">
      <div
        className="rounded-sm bg-surface-success px-2 py-1 text-sm leading-5 text-text-body"
        data-testid={figureTestId(props.idPrefix, 'yourSavings')}
      >
        <span>{props.label} </span>
        <span className="font-bold">{formatCurrency(-Math.abs(props.amount), props.currency)}</span>
      </div>
    </div>
  );
}

function CheckoutGrossValueOfGoodsRow(
  props: Readonly<{ amount: number | undefined; currency: string; label: string; idPrefix: string }>,
) {
  if (typeof props.amount !== 'number') {
    return null;
  }
  return (
    <div className="flex justify-between" data-testid={figureTestId(props.idPrefix, 'grossValueOfGoods')}>
      <span>{props.label}</span>
      <span className="font-bold">{formatCurrency(props.amount, props.currency)}</span>
    </div>
  );
}

export type CheckoutGoodsTotalsProps = {
  breakdown: CheckoutOrderSummaryBreakdown;
  isGrossApplied: boolean;
  moneyCurrency: string;
  fallbackGross: number;
  idleGoodsAmount: number;
  idleGoodsCurrency: string;
  /** Test id prefix. Checkout keeps `checkout-`; cart passes `cart`. */
  idPrefix?: string;
};

/**
 * Shipping fee cell. With a free-shipping coupon the picked method's list fee is struck
 * through and followed by "Free" (COP-5589 QA follow-up; not specified in Figma).
 */
export function CheckoutShippingFeeValue(
  props: Readonly<{
    shippingFee: number | undefined;
    shippingFree: boolean;
    currency: string;
    idPrefix?: string;
  }>,
) {
  const t = useTranslations('checkout.summary');
  const { shippingFee, shippingFree, currency, idPrefix = 'checkout' } = props;
  if (shippingFee === undefined) {
    return <span>{t('calculatedAtCheckout')}</span>;
  }
  if (shippingFree) {
    return (
      <span className="flex items-baseline gap-2" data-testid={figureTestId(idPrefix, 'shippingFree')}>
        <span className="line-through">{formatCurrency(shippingFee, currency)}</span>
        <span className="font-bold">{t('free')}</span>
      </span>
    );
  }
  return <span>{formatCurrency(shippingFee, currency)}</span>;
}

export function CheckoutGoodsTotals(props: Readonly<CheckoutGoodsTotalsProps>) {
  const t = useTranslations('checkout.summary');
  const tCommon = useTranslations('common');
  const {
    breakdown,
    isGrossApplied,
    moneyCurrency,
    fallbackGross,
    idleGoodsAmount,
    idleGoodsCurrency,
    idPrefix = 'checkout',
  } = props;
  // Builder always sets the flag when coupons are applied; `?? true` only guards hand-built breakdowns.
  const goodsDiscounted = breakdown.goodsDiscounted ?? true;
  const { savingsTotal } = breakdown;
  const savingsBadge =
    typeof savingsTotal === 'number' && savingsTotal > 0 ? (
      <CheckoutSavingsBadge
        amount={savingsTotal}
        currency={moneyCurrency}
        label={t('yourSavings')}
        idPrefix={idPrefix}
      />
    ) : null;

  if (isGrossApplied) {
    return (
      <>
        <div className="flex justify-between">
          <span>{t('valueOfGoods')}</span>
          <span>{formatCurrency(breakdown.originalGoodsNet ?? breakdown.goodsNet, moneyCurrency)}</span>
        </div>
        <div className="flex justify-between text-base">
          <span>{tCommon('tax')}</span>
          <span>{formatCurrency(breakdown.originalGoodsVat ?? 0, moneyCurrency)}</span>
        </div>
        <div className="flex flex-col gap-2 border-t border-border-primary pt-4">
          <div className="flex justify-between" data-testid={figureTestId(idPrefix, 'originalGrossValue')}>
            <span>{t('originalGrossValue')}</span>
            <span className="line-through">
              {formatCurrency(breakdown.originalGoodsGross ?? fallbackGross, moneyCurrency)}
            </span>
          </div>
          {savingsBadge}
          <CheckoutGrossValueOfGoodsRow
            amount={breakdown.goodsDiscountedGross}
            currency={moneyCurrency}
            label={t('grossValueOfGoods')}
            idPrefix={idPrefix}
          />
        </div>
      </>
    );
  }

  if (breakdown.hasAppliedCoupons && goodsDiscounted) {
    return (
      <>
        <div className="flex flex-col gap-2">
          <div className="flex justify-between" data-testid={figureTestId(idPrefix, 'originalValueOfGoods')}>
            <span>{t('originalValueOfGoods')}</span>
            <span className="line-through">
              {formatCurrency(breakdown.originalGoodsNet ?? breakdown.goodsNet, moneyCurrency)}
            </span>
          </div>
          {savingsBadge}
        </div>
        <div className="flex justify-between border-t border-border-primary pt-4 text-base">
          <span>{t('netValueOfGoods')}</span>
          <span className="font-bold">{formatCurrency(breakdown.goodsNet, moneyCurrency)}</span>
        </div>
      </>
    );
  }

  // No coupon, or a coupon that leaves goods untouched: plain goods rows. The badge still
  // surfaces a reported saving without discounted figures, but never for a free-shipping
  // coupon — COP-4815 (QA 2026-09-15): the waiver is shown on the shipping row instead.
  const showPlainSavings = breakdown.hasAppliedCoupons === true && breakdown.shippingFree !== true;
  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <span className="">{t('valueOfGoods')}</span>
          <span>{formatCurrency(idleGoodsAmount, idleGoodsCurrency)}</span>
        </div>
        {showPlainSavings ? savingsBadge : null}
      </div>
      <div className="flex justify-between border-t border-border-primary pt-4 text-base">
        <span>{t('netValueOfGoods')}</span>
        <span className="font-bold">{formatCurrency(breakdown.goodsNet, moneyCurrency)}</span>
      </div>
    </>
  );
}
