'use client';

import { useTranslations } from 'next-intl';
import { useCartTotal } from '@/hooks/cart/useCartTotal';
import { cn, formatCurrency } from '@/lib/utils';
import type { Cart } from '@/platform/services/model/cart/cart';

interface CartPriceBreakdownProps {
  cart: Cart;
  className?: string;
  shippingLabel?: string;
  totalClassName?: string;
  rowClassName?: string;
  translationNamespace?: 'cart.summary' | 'checkout.summary';
  /** When true, the shipping row is omitted until a method is selected. */
  hideShippingUntilSelected?: boolean;
}

export function CartPriceBreakdown({
  cart,
  className,
  shippingLabel,
  totalClassName,
  rowClassName,
  translationNamespace = 'cart.summary',
  hideShippingUntilSelected = false,
}: CartPriceBreakdownProps) {
  const t = useTranslations(translationNamespace);
  const { cartTotal, shippingCosts, discountAmount, currency } = useCartTotal();
  const showShippingRow = !hideShippingUntilSelected || shippingCosts !== undefined;

  return (
    <div className={cn('space-y-4', className)}>
      <div className={cn('flex justify-between', rowClassName)}>
        <span>{t('valueOfGoods')}</span>
        <span>{formatCurrency(cart.subTotalPrice.amount, cart.subTotalPrice.currency)}</span>
      </div>

      {discountAmount !== undefined && discountAmount > 0 && (
        <div className={cn('flex justify-between text-text-action', rowClassName)}>
          <span>{t('discount')}</span>
          <span>-{formatCurrency(discountAmount, cart.totalDiscount?.currency ?? currency)}</span>
        </div>
      )}

      <div className={cn('flex justify-between text-base pt-4 border-t border-border-primary', rowClassName)}>
        <span>{t('netValueOfGoods')}</span>
        <span className="font-bold font-headlines">{formatCurrency(cart.tax.netValue, cart.tax.currency)}</span>
      </div>

      <div className="flex flex-col gap-2">
        <div className={cn('flex justify-between text-base', rowClassName)}>
          <span>{t('vat')}</span>
          <span>{formatCurrency(cart.tax.amount, cart.tax.currency)}</span>
        </div>
        {showShippingRow && (
          <div className={cn('flex justify-between text-base', rowClassName)}>
            <span>{shippingLabel ?? t('shippingCosts')}</span>
            {shippingCosts !== undefined ? (
              <span>{formatCurrency(shippingCosts, currency)}</span>
            ) : (
              <span className="text-sm text-text-placeholders">{t('calculatedAtCheckout')}</span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        {cart.fees && (
          <div className={cn('flex justify-between text-base', rowClassName)}>
            <span>{t('fees')}</span>
            <span>{formatCurrency(cart.fees.amount, cart.fees.currency)}</span>
          </div>
        )}
        <div className={cn('flex justify-between font-bold font-headlines text-lg', totalClassName)}>
          <span>{t('total')}</span>
          <span>{formatCurrency(cartTotal, currency)}</span>
        </div>
      </div>
    </div>
  );
}
