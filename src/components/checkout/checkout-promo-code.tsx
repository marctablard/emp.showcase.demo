'use client';

import { useId } from 'react';
import { useTranslations } from 'next-intl';
import { BadgePercent, Info, X } from 'lucide-react';
import { useCheckoutPromoCode } from '@/hooks/checkout/useCheckoutPromoCode';
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
  removing,
  onRemove,
  removeLabel,
}: Readonly<{
  discount: CartAppliedDiscount;
  removing: boolean;
  onRemove: (discountIndex: number) => void;
  removeLabel: string;
}>) {
  return (
    <div className="flex w-full flex-col gap-0.5" data-testid={`checkout-appliedPromo-${discount.code}`}>
      <div className="flex items-center gap-1">
        <BadgePercent className="size-[18px] shrink-0 text-icon-success" aria-hidden />
        <p className="min-w-0 flex-1 text-xs leading-5 text-text-body">{discount.code}</p>
        <button
          type="button"
          className="shrink-0 rounded-sm text-text-body focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
          data-testid={`checkout-removePromo-${discount.code}`}
          aria-label={removeLabel}
          disabled={removing}
          onClick={() => onRemove(discount.discountIndex)}
        >
          <X className="size-[18px]" aria-hidden />
        </button>
      </div>
      {(discount.name || typeof discount.amount === 'number') && (
        <div className="flex items-start justify-between gap-2 text-xs leading-5 text-text-body">
          {discount.name ? <p className="min-w-0 font-bold">{discount.name}</p> : <span />}
          <p className="shrink-0 text-right font-bold">{formatSignedAmount(discount.amount, discount.currency)}</p>
        </div>
      )}
    </div>
  );
}

/**
 * Checkout coupon field: input + Apply, generic field error, info copy, and applied chips.
 * COP-5589 — compose Input + Button so both controls can take data-testid (InputButton cannot).
 */
export function CheckoutPromoCodeBox() {
  const t = useTranslations('checkout.summary');
  const errorId = useId();
  const infoId = useId();
  const { code, setCode, applying, removing, fieldError, apply, remove, discounts } = useCheckoutPromoCode();

  const isInvalid = Boolean(fieldError);
  const canApply = Boolean(code.trim()) && !applying;
  const describedBy = isInvalid ? `${errorId} ${infoId}` : infoId;

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex w-full flex-col gap-0.5">
        <form
          className="flex h-12 w-full items-stretch"
          onSubmit={(event) => {
            event.preventDefault();
            void apply();
          }}
        >
          <div className="min-w-0 h-12 flex-1">
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
              aria-describedby={describedBy}
              data-dirty-error={isInvalid || undefined}
              data-testid="checkout-promoCode"
              disabled={applying}
              className={cn('h-12', !isInvalid && 'bg-surface-primary')}
            />
          </div>
          <Button
            type="submit"
            variant="input"
            className="h-12 font-headlines tracking-[var(--desktop-spacing-action-button)]"
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

      <div
        id={infoId}
        className="flex w-full rounded-md border border-border-secondary bg-surface-page px-4 py-2"
        data-testid="checkout-promoInfo"
      >
        <div className="flex items-start gap-1">
          <Info className="size-[18px] shrink-0 text-icon-information" aria-hidden />
          {/* Desktop/body/s-bold + s → text-sm (12/20). Parent p is 700 so captured infoCopy matches Figma. */}
          <p className="min-w-0 flex-1 text-sm font-bold leading-5 text-text-body">
            <span className="font-bold">{t('promoCodeOnePerProduct')}</span>
            <span className="font-normal">
              <br aria-hidden />
              {t('promoCodeBestPrice')}
            </span>
          </p>
        </div>
      </div>

      {discounts.length > 0 ? (
        <div className="flex w-full flex-col gap-3 rounded-md border border-border-success bg-surface-success px-4 py-2">
          {discounts.map((discount) => (
            <AppliedPromoChip
              key={`${discount.code}-${discount.discountIndex}`}
              discount={discount}
              removing={removing}
              onRemove={remove}
              removeLabel={t('removePromo')}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
