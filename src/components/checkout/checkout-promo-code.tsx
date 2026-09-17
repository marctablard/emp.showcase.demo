'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { BadgePercent, X } from 'lucide-react';
import { useCheckoutPromoCode } from '@/hooks/checkout/useCheckoutPromoCode';
import { isFreeShippingPromo, shopperFacingCartPromos } from '@/lib/common/applied-promo-display';
import { cn, formatCurrency } from '@/lib/utils';
import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

const PROMO_CODE_MAX_LENGTH = 150;

function formatSignedAmount(amount: number, currency: string): string {
  return formatCurrency(-Math.abs(amount), currency);
}

function AppliedPromoChip({
  discount,
  removingThis,
  onRemove,
  removeLabel,
  freeShippingLabel,
}: Readonly<{
  discount: CartAppliedDiscount;
  removingThis: boolean;
  onRemove: (discountIndex: number) => void;
  removeLabel: string;
  freeShippingLabel: string;
}>) {
  const isFreeShipping = isFreeShippingPromo(discount);
  return (
    <div
      className={cn('flex w-full flex-col gap-0.5', removingThis && 'cursor-progress opacity-60')}
      data-testid={`checkout-appliedPromo-${discount.code}`}
      aria-busy={removingThis || undefined}
    >
      <div className="flex items-center gap-1">
        <BadgePercent className="size-[18px] shrink-0 text-icon-success" aria-hidden />
        <p className="min-w-0 flex-1 text-sm leading-5 text-text-body">{discount.code}</p>
        <button
          type="button"
          className={cn(
            'shrink-0 cursor-pointer rounded-sm text-text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus',
            removingThis && 'cursor-progress',
          )}
          data-testid={`checkout-removePromo-${discount.code}`}
          aria-label={removeLabel}
          disabled={removingThis}
          onClick={() => onRemove(discount.discountIndex)}
        >
          <X className="size-[18px]" aria-hidden />
        </button>
      </div>
      <div className="flex items-start justify-between gap-2 text-sm leading-5 text-text-body">
        {discount.name ? <p className="min-w-0 font-normal">{discount.name}</p> : <span />}
        <p
          className="shrink-0 text-right text-sm font-normal leading-5"
          data-testid={`checkout-appliedPromoAmount-${discount.code}`}
        >
          {isFreeShipping ? freeShippingLabel : formatSignedAmount(discount.amount, discount.currency)}
        </p>
      </div>
    </div>
  );
}

/**
 * Checkout coupon field: input + Apply, generic field error, and applied chips.
 * COP-4815 QA: drop the Figma "best-price / one per product" note (only on a subset of frames
 * and not factually true when absolute + percent codes stack).
 */
export function CheckoutPromoCodeBox() {
  const t = useTranslations('checkout.summary');
  const errorId = useId();
  const { code, setCode, applying, removingIndex, fieldError, apply, remove, discounts } = useCheckoutPromoCode();

  const isInvalid = Boolean(fieldError);
  const canApply = Boolean(code.trim()) && !applying;
  const visibleDiscounts = shopperFacingCartPromos(discounts);

  return (
    <div className={cn('flex w-full flex-col gap-4', applying && 'cursor-progress')}>
      <div className="flex w-full flex-col gap-0.5">
        <form
          className={cn('flex h-12 w-full items-stretch', applying && 'cursor-progress')}
          onSubmit={(event) => {
            event.preventDefault();
            // `apply` surfaces failures through `fieldError`; nothing left to handle here.
            apply().catch(() => undefined);
          }}
        >
          {/* Figma 4452:97361 Field–Button: 306×48 + 91×48 with 1px overlap → 396×48. */}
          <div className="h-12 min-w-0 grow basis-[306px]">
            <Input
              id="checkout-promo-code"
              type="text"
              isButton
              autoComplete="off"
              spellCheck={false}
              maxLength={PROMO_CODE_MAX_LENGTH}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder={t('promoCode')}
              aria-label={t('promoCode')}
              aria-invalid={isInvalid || undefined}
              aria-describedby={isInvalid ? errorId : undefined}
              data-dirty-error={isInvalid || undefined}
              data-testid="checkout-promoCode"
              disabled={applying}
              className={cn('h-12', !isInvalid && 'bg-surface-primary', applying && 'cursor-progress')}
            />
          </div>
          <Button
            type="submit"
            variant="input"
            className={cn(
              '-ml-px h-12 w-[91px] shrink-0 font-headlines tracking-[var(--desktop-spacing-action-button)]',
              applying && 'cursor-progress',
            )}
            data-testid="checkout-applyPromo"
            disabled={!canApply}
          >
            {t('apply')}
          </Button>
        </form>
        {/* Desktop/body/s → text-sm (12/20), same mapping as idle info copy. */}
        {fieldError ? (
          <p id={errorId} role="alert" className="text-sm leading-5 text-text-error" data-testid="checkout-promoError">
            {fieldError}
          </p>
        ) : null}
      </div>

      {visibleDiscounts.length > 0 ? (
        <div className="flex w-full flex-col gap-3 rounded-md border border-border-success bg-surface-success px-4 py-2">
          {visibleDiscounts.map((discount) => (
            <AppliedPromoChip
              key={`${discount.code}-${discount.discountIndex}`}
              discount={discount}
              removingThis={removingIndex === discount.discountIndex}
              onRemove={remove}
              removeLabel={t('removePromo')}
              freeShippingLabel={t('promoFreeShipping')}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
