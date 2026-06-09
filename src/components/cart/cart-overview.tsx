'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { H3 } from '@/components/ui/h';
import { Spinner } from '@/components/ui/spinner';
import { useCart } from '@/hooks/cart/useCart';
import { useGlobalSyncReady } from '@/hooks/common/useGlobalSyncReady';
import useCustomer from '@/hooks/customer/useCustomer';
import type { Cart } from '@/platform/services/model/cart/cart';
import { CartAction } from './cart-action';
import { CartDelivery } from './cart-delivery';
import { CartEmpty } from './cart-empty';
import { CartItemList } from './cart-itemlist';
import { CartSummary } from './cart-summary';

interface CartOverviewProps {
  initialCart?: Cart | null;
}

export function CartOverview({ initialCart }: CartOverviewProps) {
  const t = useTranslations('cart');
  const { cart } = useCart(initialCart);
  const { customer } = useCustomer();
  // During a site switch (or any cross-store sync), the pipeline transiently flips the cart to
  // `null` before navigating to the new site. Without gating on syncReady the user briefly sees
  // CartEmpty in the pre-switch locale/currency. Keep the page in the loading shell until the
  // session, site, and cart stores realign — then render the authoritative final state.
  const { ready: syncReady, reason: syncReason } = useGlobalSyncReady();

  const leftContent = useRef<HTMLDivElement>(null);
  const currentCart = cart !== undefined ? cart : initialCart;
  // Only show the full-page shell when we genuinely have nothing to render, or when the
  // cross-store pipeline is not ready for a **structural** reason (site switch / session
  // mutation / cart-site mismatch). A transient `cart-loading` on a resolved cart is a
  // mid-flight item mutation on the same site — `CartItemRow` already renders a per-row
  // spinner and disables +/-/remove controls for that, so hiding the whole page would be
  // a regression.
  const showLoadingShell = currentCart === undefined || (!syncReady && syncReason !== 'cart-loading');

  if (showLoadingShell) {
    return (
      <div className="max-w-6xl mx-auto mt-8" aria-busy="true">
        <div className="mx-4 lg:mx-9">
          <div className="flex gap-3 align-end mb-8">
            <H3>{t('title')}</H3>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 mb-11">
            <div className="flex justify-center items-center col-span-full min-h-64">
              <Spinner variant="lg" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!currentCart || currentCart.items.length === 0) {
    return <CartEmpty />;
  }

  return (
    <div className="max-w-6xl mx-auto mt-8">
      <div className="mx-4 lg:mx-9">
        <div className="flex gap-3 align-end mb-8">
          <H3>{t('title')}</H3>
          <div className="text-text-on-disabled text-lg m-0 leading-[2]">
            {currentCart.items.length > 1
              ? currentCart.items.length + t('products')
              : currentCart.items.length + t('product')}
          </div>
        </div>
        <CartAction />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-8 mb-11">
          <div className="col-span-1 lg:col-span-2" ref={leftContent}>
            {false && customer && <CartDelivery />}
            <CartItemList cart={currentCart} />
          </div>
          <CartSummary cart={currentCart} boundingContent={leftContent} />
        </div>
      </div>
    </div>
  );
}
