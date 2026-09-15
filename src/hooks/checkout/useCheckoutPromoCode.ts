'use client';

import { useCallback, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLogger } from '@/hooks/common/useLogger';
import { CART_API_REASON } from '@/lib/common/cart-api-error-mapping';
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

function getApiReason(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'reason' in err && typeof (err as { reason: unknown }).reason === 'string') {
    return (err as { reason: string }).reason;
  }
  return undefined;
}

/**
 * Copy per classified rejection (`reason` from `/api/cart/[id]/discounts`). Unknown, expired and
 * unclassified rejections keep the Figma "not active" string; eligibility, already-applied and
 * cart-restriction rejections get their own copy so a valid code is never called "not active"
 * (COP-5589 QA 3.2/3.3).
 */
type PromoErrorKey = 'promoCodeError' | 'promoCodeNotEligible' | 'promoCodeNotApplicable' | 'promoCodeAlreadyApplied';

const PROMO_ERROR_KEY_BY_REASON: Partial<Record<string, PromoErrorKey>> = {
  [CART_API_REASON.COUPON_NOT_ELIGIBLE]: 'promoCodeNotEligible',
  [CART_API_REASON.COUPON_NOT_APPLICABLE]: 'promoCodeNotApplicable',
  [CART_API_REASON.COUPON_ALREADY_APPLIED]: 'promoCodeAlreadyApplied',
};

function promoErrorKeyFor(reason: string | undefined): PromoErrorKey {
  return PROMO_ERROR_KEY_BY_REASON[reason ?? ''] ?? 'promoCodeError';
}

/**
 * Checkout promo-code field state. Apply/remove go through useCart only.
 * Shopper-facing errors are always i18n strings chosen by reason class — never upstream message.
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
      const reason = getApiReason(err);
      setFieldError(t(promoErrorKeyFor(reason)));
      logger.error(
        { err, cartId, reason, upstreamStatus: getUpstreamStatus(err) },
        'Failed to apply checkout promo code',
      );
    } finally {
      setApplying(false);
    }
  }, [applyDiscount, cartId, code, logger, t]);

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
