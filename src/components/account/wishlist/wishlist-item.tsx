'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { AlertCircle, FlipHorizontal2, Minus, Package, Plus, ShoppingCart, Trash2, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useComparison } from '@/hooks/comparison/useComparison';
import { useValidateAddToComparison } from '@/hooks/comparison/useValidateAddToComparison';
import { useAvailability } from '@/hooks/product/useAvailability';
import { useL10n } from '@/hooks/useL10n';
import { useWishlist } from '@/hooks/wishlist/useWishlist';
import { type ProductAttributeKey, dk } from '@/i18n/dynamic-key';
import type { MoveWishlistItemToCartResult } from '@/lib/client/wishlist';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency } from '@/lib/utils';
import type { Product } from '@/platform/services/model/product';
import type { WishlistItem as WishlistItemModel } from '@/platform/services/model/wishlist/wishlist';
import { MAX_COMPARISON_PRODUCTS } from '@/stores/comparison-store';

interface WishlistItemProps {
  item: WishlistItemModel;
  /** Fired after a successful move-to-cart so the parent can show the confirmation modal. */
  onMovedToCart?: (item: WishlistItemModel, quantity: number, result: MoveWishlistItemToCartResult) => void;
}

const QUANTITY_DEBOUNCE_MS = 700;

export function WishlistItem({ item, onMovedToCart }: WishlistItemProps) {
  const t = useTranslations('account.wishlist');
  // Reuses cart's "X of Y available" phrasing instead of duplicating the plural key.
  const tCart = useTranslations('cart');
  const tProduct = useTranslations('product');
  const { l10n } = useL10n();
  const { updateItemQuantity, removeItem, moveItemToCart, loading } = useWishlist();
  const { availability } = useAvailability(item.productId);
  const [quantity, setQuantity] = useState(item.quantity);
  const [isProcessing, setIsProcessing] = useState(false);
  const quantityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Minimal Product shape so `useValidateAddToComparison` can apply its master-product check.
  const productForComparison: Product = {
    id: item.productId,
    name: item.name ?? item.productId,
    description: '',
    purchasable: item.isPurchasable,
    ...(item.sku ? { sku: item.sku } : {}),
  };
  const { isInComparison, toggleProduct, isFull } = useComparison();
  const { disabled: compareDisabled, tooltip: compareTooltip } = useValidateAddToComparison(productForComparison);
  const isCompared = isInComparison(item.productId);

  useEffect(() => {
    if (item.quantity !== quantity) setQuantity(item.quantity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.quantity]);

  useEffect(() => {
    return () => {
      if (quantityDebounceRef.current) clearTimeout(quantityDebounceRef.current);
    };
  }, []);

  const isActionable = item.isPurchasable && item.hasCurrentPrice;
  const showUnavailable = !item.isPurchasable;
  const showNoPrice = item.isPurchasable && !item.hasCurrentPrice;
  // `availability === null` = stock fetch in flight → fall through to "Online Available"
  // rather than flicker between states.
  const showPartialStock = isActionable && availability !== null && availability.availableQuantity < item.quantity;

  const cancelPendingQuantityUpdate = () => {
    if (quantityDebounceRef.current) {
      clearTimeout(quantityDebounceRef.current);
      quantityDebounceRef.current = null;
    }
  };

  const handleUpdateQuantity = async (newQty: number) => {
    if (newQty < 1 || !isActionable || isProcessing) return;
    cancelPendingQuantityUpdate();
    setIsProcessing(true);
    try {
      setQuantity(newQty);
      await updateItemQuantity(item.productId, newQty);
    } catch (error) {
      getLogger().error({ err: error }, 'Failed to update wishlist quantity');
      setQuantity(item.quantity);
      notify({
        title: t('notifications.updateQuantityError', { product: l10n(item.name) || item.productId }),
        type: ToastType.Error,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuantityInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (Number.isNaN(value) || value < 1) return;
    setQuantity(value);
    // Debounce: only commit ~700 ms after the LAST keystroke so we don't PATCH every digit.
    cancelPendingQuantityUpdate();
    quantityDebounceRef.current = setTimeout(() => {
      quantityDebounceRef.current = null;
      handleUpdateQuantity(value);
    }, QUANTITY_DEBOUNCE_MS);
  };

  const handleRemove = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    const productName = l10n(item.name) || item.productId;
    try {
      await removeItem(item.productId);
      notify({
        title: t('notifications.removeSuccess', { product: productName }),
        type: ToastType.Success,
      });
    } catch (error) {
      getLogger().error({ err: error }, 'Failed to remove wishlist item');
      notify({
        title: t('notifications.removeError', { product: productName }),
        type: ToastType.Error,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCompareClick = () => {
    const productName = l10n(item.name) || item.productId;
    if (isCompared) {
      toggleProduct(item.productId);
      notify({ title: tProduct('removedFromComparison', { name: productName }), type: ToastType.Info });
    } else if (isFull) {
      notify({
        title: tProduct('comparisonFull', { max: MAX_COMPARISON_PRODUCTS }),
        type: ToastType.Warning,
      });
    } else {
      toggleProduct(item.productId);
      notify({ title: tProduct('addedToComparison', { name: productName }), type: ToastType.Success });
    }
  };

  const handleAddToCart = async () => {
    if (!isActionable || isProcessing) return;
    setIsProcessing(true);
    // Snapshot before the move — the wishlist line is gone (and this row unmounted) by the
    // time the modal opens.
    const movedItem = item;
    const movedQuantity = item.quantity;
    const productName = l10n(item.name) || item.productId;
    try {
      const result = await moveItemToCart(item.productId);
      onMovedToCart?.(movedItem, movedQuantity, result);

      if (result.partialFailure === 'wishlist-remove-failed') {
        notify({
          title: t('notifications.moveToCartPartialFailure', { product: productName }),
          type: ToastType.Warning,
        });
      }
    } catch (error) {
      getLogger().error({ err: error }, 'Failed to move wishlist item to cart');
      notify({
        title: t('notifications.moveToCartError', { product: productName }),
        type: ToastType.Error,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const grossAmount = item.price?.gross.amount;
  const grossOriginalAmount = item.price?.gross.originalAmount;
  const netAmount = item.price?.net.amount;
  const currency = item.price?.gross.currency;
  const hasPriceToShow = item.hasCurrentPrice && grossAmount !== undefined && currency !== undefined;
  const hasDiscount = grossOriginalAmount !== undefined && grossOriginalAmount !== grossAmount;
  const displayName = l10n(item.name) || item.productId;
  const busy = isProcessing || loading;

  // Shared sub-elements — defined once, assembled differently per layout.

  const productNameLink = (
    <UiLink
      type="Link"
      variant="textNoUnderline"
      className="font-headlines text-2xl text-text-headings"
      href={`/product/${item.productId}`}
    >
      {displayName}
    </UiLink>
  );

  const imageThumb = (
    <div className="w-14 h-14 shrink-0 rounded-ss-md rounded-ee-md overflow-hidden bg-surface-image-background flex items-center justify-center">
      {item.imageUrl ? (
        <Image src={item.imageUrl} alt={displayName} width={56} height={56} className="object-contain w-full h-full" />
      ) : (
        <ShoppingCart className="h-5 w-5 opacity-30 text-icon-secondary" />
      )}
    </div>
  );

  const priceBlock = (
    <div>
      {hasPriceToShow ? (
        <>
          {hasDiscount && (
            <p className="text-sm text-text-secondary line-through tabular-nums">
              {formatCurrency(grossOriginalAmount, currency)}
            </p>
          )}
          <p className={`font-bold tabular-nums${hasDiscount ? ' text-text-error' : ''}`}>
            {formatCurrency(grossAmount, currency)}
          </p>
          {netAmount !== undefined && (
            <p className="text-sm text-text-secondary tabular-nums">
              {t('net')} {formatCurrency(netAmount, currency)}
            </p>
          )}
        </>
      ) : (
        <>
          <p className="font-bold">{t('priceUnavailable')}</p>
          <p className="text-sm text-text-secondary">
            {t('net')} {t('priceUnavailable')}
          </p>
        </>
      )}
    </div>
  );

  const itemNumberLine = (
    <p className="text-sm text-text-secondary">
      {t('itemNumber')}: {item.sku || item.productId}
    </p>
  );

  const keySpecsLines =
    item.keySpecs && item.keySpecs.length > 0 ? (
      <div className="flex flex-col gap-1">
        {item.keySpecs.map((spec) => (
          <p key={`${spec.source}-${spec.key}`} className="text-sm">
            <span className="font-bold">
              {tProduct(dk<ProductAttributeKey>(spec.labelKey), { defaultValue: spec.key })}:
            </span>{' '}
            <span>{l10n(spec.value)}</span>
          </p>
        ))}
      </div>
    ) : null;

  const statusLine = showUnavailable ? (
    <p className="flex items-center gap-2 text-sm text-text-warning">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      {t('statuses.unavailable')}
    </p>
  ) : showNoPrice ? (
    <p className="flex items-center gap-2 text-sm text-text-warning">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      {t('statuses.noPrice')}
    </p>
  ) : showPartialStock ? (
    <p className="flex items-center gap-2 text-sm text-text-warning">
      <Package className="h-4 w-4" aria-hidden="true" />
      {tCart('substitution.availableDescription', {
        available: availability!.availableQuantity,
        total: item.quantity,
      })}
    </p>
  ) : (
    <p className="flex items-center gap-2 text-sm text-text-success">
      <Truck className="h-4 w-4" aria-hidden="true" />
      {t('statuses.onlineAvailable')}
    </p>
  );

  const removeButton = (
    <Button
      variant="link"
      size="small"
      className="p-0 self-start normal-case tracking-normal text-sm font-bold gap-2"
      onClick={handleRemove}
      disabled={busy}
      data-testid={`wishlist-remove-${item.productId}`}
    >
      <Trash2 className="w-5 h-5" aria-hidden="true" />
      {t('actions.removeFromList')}
    </Button>
  );

  const quantityControls = (
    <div className="flex">
      <Button
        variant="secondary"
        size="icon"
        className="p-3 h-12 border-border-primary rounded-none rounded-ss-sm rounded-es-sm"
        disabled={!isActionable || quantity <= 1 || busy}
        onClick={() => handleUpdateQuantity(quantity - 1)}
        aria-label={t('decrement')}
        data-testid={`wishlist-quantity-decrement-${item.productId}`}
      >
        <Minus className="h-5 w-5" aria-hidden="true" />
      </Button>
      <div className="w-15 h-12 border-y border-border-primary flex items-center">
        {isProcessing ? (
          <div className="w-full h-full flex items-center justify-center">
            <Spinner color="primary" variant="sm" />
          </div>
        ) : (
          <Input
            value={quantity}
            onChange={handleQuantityInput}
            disabled={!isActionable || busy}
            aria-label={t('quantity')}
            className="py-3 text-center border-none"
            data-testid={`wishlist-quantity-${item.productId}`}
          />
        )}
      </div>
      <Button
        variant="secondary"
        size="icon"
        className="p-3 h-12 border-border-primary rounded-none rounded-se-sm rounded-ee-sm"
        disabled={!isActionable || busy}
        onClick={() => handleUpdateQuantity(quantity + 1)}
        aria-label={t('increment')}
        data-testid={`wishlist-quantity-increment-${item.productId}`}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );

  const compareLabel = isCompared ? tProduct('compareTooltipRemove') : tProduct('compareTooltipAdd');
  const actionButtons = (
    <div className="flex gap-2">
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button
              variant={isCompared ? 'primary' : 'secondary'}
              size="icon"
              className="h-12 w-12 border-border-primary"
              disabled={compareDisabled || busy}
              onClick={handleCompareClick}
              aria-label={compareLabel}
              aria-pressed={isCompared}
              data-testid={`wishlist-compare-${item.productId}`}
            >
              <FlipHorizontal2 className="h-5 w-5" aria-hidden="true" />
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{compareTooltip ?? compareLabel}</TooltipContent>
      </Tooltip>
      <Button
        variant="primary"
        size="icon"
        className="h-12 w-12"
        disabled={!isActionable || busy}
        onClick={handleAddToCart}
        aria-label={t('actions.addToCart')}
        data-testid={`wishlist-add-to-cart-${item.productId}`}
      >
        <ShoppingCart className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );

  return (
    <div className="py-6">
      {/* Mobile (< sm = < 768px): vertically stacked card */}
      <div className="sm:hidden flex flex-col gap-3">
        {productNameLink}
        <div className="flex items-start gap-4">
          {imageThumb}
          {priceBlock}
        </div>
        {itemNumberLine}
        {keySpecsLines}
        {statusLine}
        {removeButton}
        <div className="flex items-center justify-between gap-3">
          {quantityControls}
          {actionButtons}
        </div>
      </div>

      {/* Tablet & desktop (≥ sm): 4-column table row */}
      <div className="hidden sm:grid grid-cols-[56px_1.5fr_1fr_1.6fr] gap-x-4 items-start">
        {imageThumb}
        <div className="flex flex-col gap-2">
          {productNameLink}
          {itemNumberLine}
          {keySpecsLines}
          {statusLine}
          {removeButton}
        </div>
        <div className="flex items-center">{quantityControls}</div>
        <div className="flex flex-col gap-2 items-end">
          {actionButtons}
          <div className="text-end">{priceBlock}</div>
        </div>
      </div>
    </div>
  );
}
