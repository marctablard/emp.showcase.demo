'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCart } from '@/hooks/cart/useCart';
import { cn } from '@/lib/utils';
import type { CartDiscount } from '@/platform/services/model/cart/cart';
import { ToastType, notify } from '../ui/toast-notification';

interface PromoCodeInputProps {
  translationNamespace?: 'cart.summary' | 'checkout.summary';
  className?: string;
}

export function PromoCodeInput({ translationNamespace = 'cart.summary', className }: PromoCodeInputProps) {
  const t = useTranslations(translationNamespace);
  const { cart, applyPromoCode, removePromoCode, loading } = useCart();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleApply = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode || submitting || loading) {
      return;
    }

    setSubmitting(true);
    try {
      await applyPromoCode(trimmedCode);
      setCode('');
      notify({ type: ToastType.Success, title: t('promoCodeApplied') });
    } catch (error) {
      notify({
        type: ToastType.Error,
        title: error instanceof Error ? error.message : t('promoCodeError'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (discount: CartDiscount) => {
    if (submitting || loading) {
      return;
    }

    setSubmitting(true);
    try {
      await removePromoCode(discount.code);
      notify({ type: ToastType.Success, title: t('promoCodeRemoved') });
    } catch (error) {
      notify({
        type: ToastType.Error,
        title: error instanceof Error ? error.message : t('promoCodeError'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex gap-2">
        <Input
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder={t('promoCode')}
          disabled={submitting || loading}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void handleApply();
            }
          }}
          data-testid="promo-code-input"
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleApply()}
          disabled={!code.trim() || submitting || loading}
          data-testid="promo-code-apply"
        >
          {t('apply')}
        </Button>
      </div>

      {cart?.discounts && cart.discounts.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cart.discounts.map((discount) => (
            <span
              key={discount.code}
              className="inline-flex max-w-full items-center gap-1 rounded-pill border border-border-primary bg-surface-page px-2 py-0.5 text-xs text-text-body"
            >
              <span className="truncate">{discount.code}</span>
              <button
                type="button"
                className="inline-flex shrink-0 rounded-full p-0.5 text-text-placeholders transition-colors hover:bg-surface-disabled hover:text-text-body disabled:pointer-events-none"
                aria-label={t('removePromoCode', { code: discount.code })}
                onClick={() => void handleRemove(discount)}
                disabled={submitting || loading}
                data-testid={`promo-code-remove-${discount.code}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
