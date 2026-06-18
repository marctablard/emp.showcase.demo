'use client';

import { useTranslations } from 'next-intl';
import { Pin } from 'lucide-react';
import { useWishlist } from '@/hooks/wishlist/useWishlist';
import { Link } from '@/i18n/navigation';

export function HeaderWishlistButton() {
  const t = useTranslations('layout.header');
  const { wishlist, totalQuantity } = useWishlist();
  const showBadge = wishlist != null && totalQuantity > 0;
  const label = showBadge ? `${t('wishlists')} (${totalQuantity})` : t('wishlists');

  return (
    <Link
      aria-label={label}
      href="/account/wishlists"
      className="flex flex-col text-icon-primary-dark items-center min-w-12 rounded-button p-0.5 hover:bg-surface-action hover:text-text-on-action transition-colors focus-visible:outline-2 focus:outline-border-focus"
    >
      <div className="relative">
        <Pin className="w-8 h-8" aria-hidden="true" />
        {showBadge && (
          <span
            aria-hidden="true"
            className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-surface-success text-xs font-bold leading-5 text-center tabular-nums"
          >
            {totalQuantity}
          </span>
        )}
      </div>
      <p className="text-sm font-bold -mt-1" aria-hidden="true">
        {t('wishlists')}
      </p>
    </Link>
  );
}
