'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ReceiptText, ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { H4 } from '@/components/ui/h';
import { useWishlist } from '@/hooks/wishlist/useWishlist';
import type { MoveWishlistItemToCartResult } from '@/lib/client/wishlist';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency } from '@/lib/utils';
import type { Wishlist, WishlistItem as WishlistItemModel } from '@/platform/services/model/wishlist/wishlist';

export interface BulkMoveItemSuccess {
  item: WishlistItemModel;
  quantity: number;
  result: MoveWishlistItemToCartResult;
}

export interface BulkMoveItemFailure {
  item: WishlistItemModel;
  quantity: number;
  error: Error;
}

export interface BulkMoveResult {
  moved: BulkMoveItemSuccess[];
  failed: BulkMoveItemFailure[];
}

interface WishlistSummaryProps {
  wishlist: Wishlist;
  onBulkMoveCompleted?: (result: BulkMoveResult) => void;
}

export function WishlistSummary({ wishlist, onBulkMoveCompleted }: WishlistSummaryProps) {
  const t = useTranslations('account.wishlist');
  const { moveItemToCart, loading } = useWishlist();
  const [isAdding, setIsAdding] = useState(false);

  const totalGross = wishlist.totalKnownPrice?.gross;
  const actionableItems = wishlist.items.filter((item) => item.isPurchasable && item.hasCurrentPrice);
  const canAddAll = actionableItems.length > 0;
  const busy = isAdding || loading;

  const handleAddAllToCart = async () => {
    if (!canAddAll || isAdding) return;
    setIsAdding(true);
    // Snapshot the actionable items BEFORE the loop — each move mutates the store and removes
    // the line from `wishlist.items`, so we can't look them up by id mid-loop.
    const snapshot = actionableItems.map((item) => ({ item, quantity: item.quantity }));
    const moved: BulkMoveItemSuccess[] = [];
    const failed: BulkMoveItemFailure[] = [];
    try {
      for (const { item, quantity } of snapshot) {
        try {
          const result = await moveItemToCart(item.productId);
          moved.push({ item, quantity, result });
        } catch (error) {
          const err = error instanceof Error ? error : new Error(String(error));
          getLogger().error({ err, productId: item.productId }, 'Failed to move wishlist item to cart during add-all');
          failed.push({ item, quantity, error: err });
        }
      }
    } finally {
      setIsAdding(false);
    }
    onBulkMoveCompleted?.({ moved, failed });
  };

  return (
    <aside className="rounded-md bg-surface-action-hover-2 p-5 flex flex-col gap-4 self-start shadow-sm">
      <div className="rounded-md bg-surface-primary p-4 flex flex-col gap-3">
        <H4 className="flex items-center gap-2">
          <ReceiptText className="w-[24px] h-[30px] shrink-0 text-icon-action" />
          {t('totalValue.title')}
        </H4>
        <div className="flex items-center justify-between gap-3 font-headlines text-3xl text-text-headings">
          <span>{t('totalValue.label')}</span>
          <span className="tabular-nums">
            {totalGross ? formatCurrency(totalGross.amount, totalGross.currency) : t('priceUnavailable')}
          </span>
        </div>
      </div>
      <Button
        variant="primary"
        className="w-full"
        disabled={!canAddAll || busy}
        onClick={handleAddAllToCart}
        data-testid="wishlist-add-all-to-cart"
      >
        <ShoppingCart className="w-[22px] h-[22px]" />
        {t('actions.addAllToCart')}
      </Button>
    </aside>
  );
}
