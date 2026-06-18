'use client';

import { type CSSProperties, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { CheckCircle2, Pin, X } from 'lucide-react';
import { toast as sonnerToast } from 'sonner';
import { Button } from '@/components/ui/button';
import { H4, H6 } from '@/components/ui/h';
import { useL10n } from '@/hooks/useL10n';
import type { WishlistItem } from '@/platform/services/model/wishlist/wishlist';

interface WishlistAddedNotificationProps {
  id: string | number;
  item: WishlistItem;
  quantity: number;
}

const CART_BUTTON_ANCHOR_SELECTOR = '[data-anchor="header-cart-button"]';
const ANCHOR_OFFSET_TOP = 8;
const ANCHOR_OFFSET_RIGHT = 8;
const DESKTOP_ANCHOR_MIN_WIDTH = 1024;

function WishlistAddedNotification({ id, item, quantity }: WishlistAddedNotificationProps) {
  const t = useTranslations('product.addToWishlistResult');
  const { l10n } = useL10n();
  const productName = l10n(item.name) || item.productId;
  const dismiss = () => sonnerToast.dismiss(id);
  const [anchorStyle, setAnchorStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') return;

    const updatePosition = () => {
      if (window.innerWidth < DESKTOP_ANCHOR_MIN_WIDTH) {
        setAnchorStyle(null);
        return;
      }
      const anchor = document.querySelector<HTMLElement>(CART_BUTTON_ANCHOR_SELECTOR);
      const rect = anchor?.getBoundingClientRect();
      // Fall back to sonner's layout if the anchor isn't mounted (e.g. checkout page) or
      // hasn't laid out yet (Suspense fallback active).
      if (!rect || rect.width === 0 || rect.height === 0) {
        setAnchorStyle(null);
        return;
      }
      setAnchorStyle({
        position: 'fixed',
        top: `${rect.top + ANCHOR_OFFSET_TOP}px`,
        right: `${window.innerWidth - rect.right + ANCHOR_OFFSET_RIGHT}px`,
        left: 'auto',
        zIndex: 9999,
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, []);

  const card = (
    <div
      className="w-full sm:w-[616px] sm:max-w-[616px] rounded-md bg-surface-primary shadow-xl flex flex-col gap-6 p-5"
      style={anchorStyle ?? undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <H4>{t('title')}</H4>
        <button onClick={dismiss} aria-label={t('close')} type="button" className="text-icon-primary-dark">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-start gap-3">
        <div className="w-14 h-14 shrink-0 rounded-ss-md rounded-ee-md overflow-hidden bg-surface-image-background flex items-center justify-center">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={productName}
              width={56}
              height={56}
              className="object-contain w-full h-full"
            />
          ) : (
            <Pin className="h-5 w-5 text-icon-secondary opacity-30" />
          )}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <H6 className="truncate">{productName}</H6>
          <p className="text-sm text-text-secondary">
            {t('itemNumber')}: {item.sku || item.productId}
          </p>
          <p className="flex items-center gap-2 text-base text-text-success">
            <CheckCircle2 className="h-[22px] w-[22px] shrink-0" />
            {t('quantityAdded', { count: quantity })}
          </p>
        </div>
      </div>
      <Button variant="primary" className="w-full" onClick={dismiss}>
        {t('ok')}
      </Button>
    </div>
  );

  // Portal out of sonner's animation container (transform creates a containing block for
  // `position: fixed`); without this the card anchors to sonner's frame, not the viewport.
  if (anchorStyle && typeof document !== 'undefined') {
    return createPortal(card, document.body);
  }
  return card;
}

export function notifyWishlistAdded(item: WishlistItem, quantity: number) {
  return sonnerToast.custom((id) => <WishlistAddedNotification id={id} item={item} quantity={quantity} />, {
    duration: 6000,
    position: 'top-center',
    className:
      'w-full px-4 mt-17 sm:px-9 sm:mt-30 sm:flex sm:justify-end sm:[&>div]:w-[616px] sm:[&>div]:max-w-[616px]',
  });
}
