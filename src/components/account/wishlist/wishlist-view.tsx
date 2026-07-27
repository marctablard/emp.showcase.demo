'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AddToCartModal } from '@/components/cart/add-to-cart-modal';
import { H2 } from '@/components/ui/h';
import { Spinner } from '@/components/ui/spinner';
import { useWishlist } from '@/hooks/wishlist/useWishlist';
import type { MoveWishlistItemToCartResult } from '@/lib/client/wishlist';
import type { CartStatus, CartStatusDetailCode } from '@/platform/services/cart/CartService';
import type { Product } from '@/platform/services/model/product';
import type { WishlistItem as WishlistItemModel } from '@/platform/services/model/wishlist/wishlist';
import { WishlistBulkMoveResultModal, type WishlistBulkMoveResultMode } from './wishlist-bulk-move-result-modal';
import { WishlistItem } from './wishlist-item';
import { type BulkMoveResult, WishlistSummary } from './wishlist-summary';

interface MovedToCartState {
  item: WishlistItemModel;
  quantity: number;
  status: CartStatus;
  statusDetailCode?: CartStatusDetailCode;
  statusDetailPayload?: { availableQuantity?: number } & Record<string, unknown>;
}

interface BulkResultState {
  mode: WishlistBulkMoveResultMode;
}

export function WishlistView() {
  const t = useTranslations('account.wishlist');
  const { wishlist, loading } = useWishlist();
  const [movedToCart, setMovedToCart] = useState<MovedToCartState | null>(null);
  const [bulkResult, setBulkResult] = useState<BulkResultState | null>(null);

  const handleMovedToCart = (item: WishlistItemModel, quantity: number, result: MoveWishlistItemToCartResult) => {
    setMovedToCart({
      item,
      quantity,
      status: result.status,
      statusDetailCode: result.statusDetailCode,
      statusDetailPayload: result.statusDetailPayload,
    });
  };

  const handleBulkMoveCompleted = ({ moved, failed }: BulkMoveResult) => {
    if (moved.length === 0 && failed.length === 0) return;
    const hasInsufficientStock = moved.some((m) => m.result.statusDetailCode === 'addToCart.insufficientStock');
    const hasWishlistRemoveFailed = moved.some((m) => m.result.partialFailure === 'wishlist-remove-failed');
    const hasAnyIssue = hasInsufficientStock || hasWishlistRemoveFailed || failed.length > 0;
    setBulkResult({ mode: hasAnyIssue ? 'warning' : 'success' });
  };

  const productForModal: Product | null = movedToCart
    ? {
        id: movedToCart.item.productId,
        name: movedToCart.item.name ?? movedToCart.item.productId,
        description: '',
        purchasable: movedToCart.item.isPurchasable,
        ...(movedToCart.item.sku ? { sku: movedToCart.item.sku } : {}),
        ...(movedToCart.item.imageUrl ? { images: [{ url: movedToCart.item.imageUrl }] } : {}),
      }
    : null;

  let content: React.ReactNode;
  if (wishlist === undefined) {
    content = (
      <div className="flex items-center justify-center py-16">
        <Spinner color="primary" variant="sm" />
      </div>
    );
  } else if (wishlist === null || wishlist.items.length === 0) {
    content = (
      <div className="flex flex-col gap-6">
        <H2>{t('title')}</H2>
        <p className="text-text-secondary">{t('empty')}</p>
      </div>
    );
  } else {
    content = (
      <div className="flex flex-col gap-6 pb-12">
        <H2>{t('title')}</H2>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_minmax(min-content,444px)] gap-6 items-start">
          <section
            aria-label={t('title')}
            aria-busy={loading || undefined}
            className="rounded-md shadow-sm bg-surface-primary p-6"
          >
            <div className="hidden sm:grid grid-cols-[56px_1.5fr_1fr_1.6fr] gap-x-4 border-b border-border-primary pb-3 mb-2 font-headlines text-2xl text-text-headings">
              <span className="col-span-2">{t('columns.product')}</span>
              <span>{t('columns.quantity')}</span>
              <span className="sm:text-end">{t('columns.unitPrice')}</span>
            </div>
            <ul className="flex flex-col divide-y divide-border-primary">
              {wishlist.items.map((item) => (
                <li key={item.id}>
                  <WishlistItem item={item} onMovedToCart={handleMovedToCart} />
                </li>
              ))}
            </ul>
          </section>
          <WishlistSummary wishlist={wishlist} onBulkMoveCompleted={handleBulkMoveCompleted} />
        </div>
      </div>
    );
  }

  return (
    <>
      {content}
      {productForModal && movedToCart && (
        <AddToCartModal
          isOpen
          onClose={() => setMovedToCart(null)}
          status={movedToCart.status}
          statusDetailCode={movedToCart.statusDetailCode}
          statusDetailPayload={movedToCart.statusDetailPayload}
          product={productForModal}
          quantity={movedToCart.quantity}
        />
      )}
      {bulkResult && <WishlistBulkMoveResultModal isOpen onClose={() => setBulkResult(null)} mode={bulkResult.mode} />}
    </>
  );
}
