'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLogger } from '@/hooks/common/useLogger';
import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import { useCart } from '../cart/useCart';

export interface UseCheckoutPromoCode {
  code: string;
  setCode: (value: string) => void;
  applying: boolean;
  removing: boolean;
  fieldError: string | null;
  apply: () => Promise<void>;
  remove: (discountIndex: number) => Promise<void>;
  discounts: CartAppliedDiscount[];
}

function getUpstreamStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err && typeof (err as { status: unknown }).status === 'number') {
    return (err as { status: number }).status;
  }
  return undefined;
}

/**
 * Checkout promo-code field state. Apply/remove go through useCart only.
 * Shopper-facing errors are always the generic i18n string — never upstream message.
 */
export function useCheckoutPromoCode(): UseCheckoutPromoCode {
  const t = useTranslations('checkout.summary');
  const logger = useLogger();
  const { cart, applyDiscount, removeDiscount } = useCart();
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const genericError = t('promoCodeError');
  const discounts = cart?.discounts ?? [];
  const cartId = cart?.id;

  const apply = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed || !cartId) {
      return;
    }

    setApplying(true);
    setFieldError(null);
    try {
      await applyDiscount(trimmed);
      setCode('');
    } catch (err) {
      setFieldError(genericError);
      logger.error({ err, cartId, upstreamStatus: getUpstreamStatus(err) }, 'Failed to apply checkout promo code');
    } finally {
      setApplying(false);
    }
  }, [applyDiscount, cartId, code, genericError, logger]);

  const remove = useCallback(
    async (discountIndex: number) => {
      if (!cartId) {
        return;
      }

      setRemoving(true);
      setFieldError(null);
      try {
        await removeDiscount(discountIndex);
      } catch (err) {
        setFieldError(genericError);
        logger.error({ err, cartId, upstreamStatus: getUpstreamStatus(err) }, 'Failed to remove checkout promo code');
      } finally {
        setRemoving(false);
      }
    },
    [cartId, genericError, logger, removeDiscount],
  );

  return {
    code,
    setCode,
    applying,
    removing,
    fieldError,
    apply,
    remove,
    discounts,
  };
}
