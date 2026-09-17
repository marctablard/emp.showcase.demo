'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLogger } from '@/hooks/common/useLogger';
import { currentDiscountIndexForCode } from '@/lib/common/applied-promo-display';
import { CART_API_REASON } from '@/lib/common/cart-api-error-mapping';
import type { CartAppliedDiscount } from '@/platform/services/model/cart/cart';
import { isCartMutationCancelledError } from '@/stores/cart-store';
import { useCart } from '../cart/useCart';

export interface UseCheckoutPromoCode {
  code: string;
  setCode: (value: string) => void;
  applying: boolean;
  removing: boolean;
  removingIndex: number | null;
  fieldError: string | null;
  apply: () => Promise<void>;
  remove: (code: string) => Promise<void>;
  discounts: CartAppliedDiscount[];
  /** True while any cart write is queued or running — promo DELETE is positional. */
  cartMutating: boolean;
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
  const { cart, applyDiscount, removeDiscount, mutating } = useCart();
  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  const discounts = cart?.discounts ?? [];
  const cartId = cart?.id;
  const mutationLockRef = useRef(false);

  const apply = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed || !cartId || mutationLockRef.current || mutating) {
      return;
    }

    mutationLockRef.current = true;
    setApplying(true);
    setFieldError(null);
    try {
      await applyDiscount(trimmed);
      setCode('');
    } catch (err) {
      if (isCartMutationCancelledError(err)) {
        return;
      }
      const reason = getApiReason(err);
      setFieldError(t(promoErrorKeyFor(reason)));
      logger.error(
        { err, cartId, reason, upstreamStatus: getUpstreamStatus(err) },
        'Failed to apply checkout promo code',
      );
    } finally {
      mutationLockRef.current = false;
      setApplying(false);
    }
  }, [applyDiscount, cartId, code, logger, mutating, t]);

  const remove = useCallback(
    async (code: string) => {
      if (!cartId || mutationLockRef.current || mutating) {
        return;
      }
      const freshIndex = currentDiscountIndexForCode(cart?.discounts, code);
      if (typeof freshIndex === 'number') {
        mutationLockRef.current = true;
        setRemovingIndex(freshIndex);
        setFieldError(null);
        try {
          await removeDiscount(freshIndex);
        } catch (err) {
          if (isCartMutationCancelledError(err)) {
            return;
          }
          setFieldError(t('promoCodeRemoveError'));
          logger.error({ err, cartId, upstreamStatus: getUpstreamStatus(err) }, 'Failed to remove checkout promo code');
        } finally {
          mutationLockRef.current = false;
          setRemovingIndex(null);
        }
      }
    },
    [cart, cartId, logger, mutating, removeDiscount, t],
  );

  return {
    code,
    setCode,
    applying,
    removing: removingIndex !== null,
    removingIndex,
    fieldError,
    apply,
    remove,
    discounts,
    cartMutating: mutating,
  };
}
