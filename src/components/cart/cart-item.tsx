'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { BadgePercent, Coins, Loader2, Minus, Package, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { UINotification } from '@/components/ui/molecules/ui-notification';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/cart/useCart';
import { useSyncedState } from '@/hooks/common/use-synced-state';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useAvailability } from '@/hooks/product/useAvailability';
import { useL10n } from '@/hooks/useL10n';
import { useWishlistAddWithAuth } from '@/hooks/wishlist/useWishlistAddWithAuth';
import { cartCouponCodesForMessage } from '@/lib/common/applied-promo-display';
import { PRODUCT_NO_IMAGE_SRC, resolveProductImageSrc } from '@/lib/common/product-image';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn, formatCurrency } from '@/lib/utils';
import type { Cart, CartItem, CartItemPriceChange, CartItemSubstitution } from '@/platform/services/model/cart/cart.d';
import type { StorefrontNotification } from '@/platform/services/model/notification/notification';
import { isCartMutationCancelledError } from '@/stores/cart-store';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';
import { ItemPriceChangeModal } from './item-price-change-modal';
import { SubstitutionModal } from './substitution-modal';

interface CartItemProps {
  cart: Cart;
  item: CartItem;
  showQty?: boolean;
}

function resolveCartItemNetAmount(item: CartItem): number {
  const net = item.tax?.netValue;
  if (typeof net === 'number' && net > 0) {
    return net;
  }
  return item.price.amount;
}

function resolveCartItemGrossAmount(item: CartItem): number | undefined {
  const gross = item.tax?.grossValue;
  return typeof gross === 'number' && gross > 0 ? gross : undefined;
}

const COUPON_CODE_VISIBLE_LENGTH = 16;

function lineCouponSavings(item: CartItem) {
  return (item.couponDiscounts ?? []).filter((coupon) => coupon.type !== 'FREE_SHIPPING' && coupon.amount > 0.005);
}

function visibleCouponCode(code: string): string {
  if (code.length <= COUPON_CODE_VISIBLE_LENGTH) {
    return code;
  }
  return `${code.slice(0, COUPON_CODE_VISIBLE_LENGTH)}…`;
}

function CouponCodeLabel({ code, productId }: Readonly<{ code: string; productId: string }>) {
  const visible = visibleCouponCode(code);
  const className = 'order-3 shrink-0 text-sm leading-5 whitespace-nowrap text-text-body sm:order-none';
  if (visible === code) {
    return <span className={className}>{code}</span>;
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className={cn(className, 'cursor-default border-0 bg-transparent p-0 font-[inherit]')}
          aria-label={code}
          data-testid={`cart-item-couponCode-${productId}-${code}`}
        >
          {visible}
        </button>
      </TooltipTrigger>
      <TooltipContent className="break-all">{code}</TooltipContent>
    </Tooltip>
  );
}

function CartItemPriceColumn({
  item,
  grossLabel,
  priceChange,
  onOpenPriceChange,
}: Readonly<{
  item: CartItem;
  grossLabel: string;
  priceChange: CartItemPriceChange | null;
  onOpenPriceChange: () => void;
}>) {
  const t = useTranslations('cart');
  const netAmount = resolveCartItemNetAmount(item);
  const grossAmount = resolveCartItemGrossAmount(item);
  const coupons = lineCouponSavings(item);
  const productId = item.product?.id ?? item.id;
  const originalNet = item.originalNet;
  const showOriginalNet = typeof originalNet === 'number' && originalNet - netAmount >= 0.005;

  return (
    <div
      className={cn(
        'col-start-2 row-start-2 flex flex-col gap-1 ps-4 sm:col-start-5 sm:row-start-1 sm:row-end-3 sm:items-end sm:ps-0',
      )}
    >
      {!showOriginalNet && item.price.originalAmount && item.price.originalAmount !== item.price.amount && (
        <p className="line-through text-text-error sm:text-end">
          {formatCurrency(item.price.originalAmount, item.price.currency)}
        </p>
      )}
      {showOriginalNet && typeof originalNet === 'number' && (
        <p className="line-through text-text-headings sm:text-end" data-testid={`cart-item-originalNet-${productId}`}>
          {formatCurrency(originalNet, item.price.currency)}
        </p>
      )}
      {coupons.map((coupon) => (
        <div
          key={coupon.code}
          className="flex flex-nowrap items-center justify-start gap-2 whitespace-nowrap sm:justify-end"
          data-testid={`cart-item-coupon-${productId}-${coupon.code}`}
        >
          <BadgePercent className="order-2 size-[18px] shrink-0 text-icon-neutral sm:order-none" aria-hidden />
          <CouponCodeLabel code={coupon.code} productId={productId} />
          <span
            className="order-1 shrink-0 rounded-sm bg-surface-success px-2 py-1 text-sm font-bold leading-5 whitespace-nowrap text-text-body sm:order-none"
            data-testid={`cart-item-couponAmount-${productId}-${coupon.code}`}
          >
            {formatCurrency(-Math.abs(coupon.amount), coupon.currency)}
          </span>
        </div>
      ))}
      <div className={cn('relative font-bold sm:text-end', showOriginalNet && 'text-text-error')}>
        {formatCurrency(netAmount, item.price.currency)}
        {priceChange && (
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0"
            onClick={onOpenPriceChange}
            aria-label={t('priceChange.title')}
            data-testid={`cart-item-priceChange-${productId}`}
          >
            <UINotification
              icon={Coins}
              iconSize={18}
              className="absolute right-[52px] bottom-[-58px]"
              animate="pulse"
            />
          </button>
        )}
      </div>
      {grossAmount !== undefined && (
        <span className="text-sm text-text-on-disabled sm:text-end">
          {grossLabel}
          {formatCurrency(grossAmount, item.price.currency)}
        </span>
      )}
    </div>
  );
}

export function CartItemRow({ cart, item, showQty }: CartItemProps) {
  const { l10n } = useL10n();
  const t = useTranslations('cart');
  const tProduct = useTranslations('product');
  const { updateItemQuantity, removeItem, loading } = useCart(cart);
  const [isProcessing, setIsProcessing] = useState(false);
  // Follows the item's quantity when it changes upstream, while staying locally editable.
  const [quantity, setQuantity] = useSyncedState(item.quantity);
  const isStrike = false;
  const { registerNotificationListener, unregisterNotificationListener, markNotificationAsRead } = useNotifications();
  const [substitution, setSubstitution] = useState<CartItemSubstitution | null>(null);
  const [substitutionNotificationId, setSubstitutionNotificationId] = useState<string | null>(null);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [priceChange, setPriceChange] = useState<CartItemPriceChange | null>(null);
  const [priceChangeNotificationId, setPriceChangeNotificationId] = useState<string | null>(null);
  const [showPriceChangeModal, setShowPriceChangeModal] = useState(false);
  const { availability } = useAvailability(item.product?.id);
  const { addToWishlist, isAdding: isAddingToWishlist, loginDialog } = useWishlistAddWithAuth();

  // Handler for cart notifications
  const handleCartNotification = useCallback(
    (notification: StorefrontNotification | string) => {
      if (typeof notification === 'string') {
        if (notification === substitutionNotificationId) {
          setShowSubstitutionModal(false);
          setSubstitutionNotificationId(null);
          setSubstitution(null);
        }
        return;
      }
      if (notification.code === 'SUBSTITUTION_AVAILABLE') {
        const substitution = notification.data_json as CartItemSubstitution;
        if (substitution.productId === item.product?.id) {
          setSubstitution(substitution);
          setSubstitutionNotificationId(notification.id);
        }
      } else if (notification.code === 'ITEM_PRICE_CHANGE') {
        const priceChange = notification.data_json as CartItemPriceChange;
        if (priceChange.productId === item.product?.id) {
          setPriceChange(priceChange);
          setPriceChangeNotificationId(notification.id);
        }
      }
      return false;
    },
    [item.product?.id, substitutionNotificationId],
  );

  // Register for cart notifications on mount
  useEffect(() => {
    const subscriptionId = registerNotificationListener('CART', handleCartNotification);
    return () => {
      unregisterNotificationListener(subscriptionId);
    };
  }, [handleCartNotification, registerNotificationListener, unregisterNotificationListener, item.product?.id, cart.id]);

  // Handle quantity update
  const handleUpdateQuantity = async (newQuantity: number) => {
    if (newQuantity < 1 || isProcessing) return;
    setIsProcessing(true);
    try {
      setQuantity(newQuantity);
      await updateItemQuantity(item.id, newQuantity);
    } catch (error) {
      setQuantity(item.quantity);
      getLogger().error({ err: error }, 'Error updating cart item quantity');
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle item removal
  const handleRemoveItem = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    try {
      setQuantity(0);
      const couponCodes = cartCouponCodesForMessage(cart.discounts);
      const removingLastItem = cart.items.length === 1;
      const { leftoverCouponsCleared } = await removeItem(item.id);
      if (removingLastItem && couponCodes.length > 0 && leftoverCouponsCleared) {
        notify({
          type: ToastType.Info,
          title: t('couponsRemovedFromEmptyCart', { codes: couponCodes.join(', ') }),
          duration: 8000,
        });
      }
    } catch (error) {
      setQuantity(item.quantity);
      if (isCartMutationCancelledError(error)) {
        return;
      }
      getLogger().error({ err: error }, 'Error removing item from cart');
    } finally {
      setIsProcessing(false);
    }
  };

  const onChangeQty = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuantity(parseInt(e.target.value));
    setTimeout(() => {
      handleUpdateQuantity(parseInt(e.target.value));
    }, 500);
  };

  const onSubstitutionDone = () => {
    if (substitutionNotificationId) {
      markNotificationAsRead(substitutionNotificationId);
      setSubstitutionNotificationId(null);
      setSubstitution(null);
    }
    setShowSubstitutionModal(false);
  };

  const onItemPriceChangeDone = () => {
    if (priceChangeNotificationId) {
      markNotificationAsRead(priceChangeNotificationId);
      setPriceChangeNotificationId(null);
      setPriceChange(null);
    }
    setShowPriceChangeModal(false);
  };

  const handleAddToWishlist = () => {
    const productId = item.product?.id;
    if (!productId || isAddingToWishlist) return;

    addToWishlist(productId, item.quantity);
  };

  const imageSrc = resolveProductImageSrc(item.product?.images?.[0]?.url);
  const imageAlt = imageSrc === PRODUCT_NO_IMAGE_SRC ? tProduct('noImage') : l10n(item.product?.name || 'Product');
  const brandName = l10n(item.product?.brand?.name || '');
  const widestQuantity = cart.items.reduce((max, line) => Math.max(max, line.quantity), item.quantity);
  const qtyLabel = `${t('qty')}: ${item.quantity}`;
  const widestQtyLabel = `${t('qty')}: ${widestQuantity}`;

  return (
    <div className="py-6 first:border-none border-t border-border-primary sm:first:border-solid">
      <div className="grid grid-cols-[1fr_2fr] sm:grid-cols-[120px_minmax(0,1fr)_auto_1.5rem_auto]">
        <div className="col-start-1 row-start-2 sm:row-start-1 row-end-3">
          <div className="flex h-[65px] w-[100px] items-center justify-center overflow-hidden rounded-ss-md rounded-ee-md bg-surface-image-background sm:h-[78px] sm:w-[120px]">
            <Image
              width={120}
              height={78}
              src={imageSrc}
              alt={imageAlt}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
        <div className="contents sm:col-start-2 sm:col-end-3 sm:row-start-1 sm:row-end-3 sm:mx-4 sm:flex sm:flex-col sm:gap-1">
          <div className="col-start-1 col-end-3 row-start-1 mb-4 flex flex-col gap-1 sm:mb-0">
            {brandName ? <p className="text-sm sm:text-base">{brandName}</p> : null}
            <UiLink
              type="Link"
              variant="textNoUnderline"
              className="font-bold text-base font-headlines cursor-pointer text-text-headings"
              href={`/product/${item.product?.id}`}
            >
              {l10n(item.product?.name || 'Product')}
            </UiLink>
          </div>
          <div
            className={cn(
              'row-start-3 col-start-2 mx-4 flex flex-col gap-2 pt-2 sm:mx-0 sm:pt-0',
              !isStrike && showQty && '-mt-4 sm:mt-0',
            )}
          >
            <p className="text-sm">
              {t('itemNumber')}: {item.product?.id}
            </p>
            {!showQty && <p className="text-sm sm:hidden">{qtyLabel}</p>}
            <div className="flex items-center gap-1">
              {availability ? (
                availability.availableQuantity >= item.quantity ? (
                  // Fully available
                  <>
                    <div className="text-icon-success">
                      <Package className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-text-success">{t('available')}</p>
                  </>
                ) : availability.availableQuantity > 0 ? (
                  // Partially available
                  <>
                    <div className="text-icon-warning">
                      <Package className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-text-warning">
                      {t('substitution.availableDescription', {
                        available: availability.availableQuantity,
                        total: item.quantity,
                      })}
                    </p>
                  </>
                ) : availability.availableInDays ? (
                  // Available in X days
                  <>
                    <div className="text-icon-warning">
                      <Package className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-text-warning">
                      {t('substitution.availableInDays', { days: availability.availableInDays })}
                    </p>
                  </>
                ) : (
                  // Not available
                  <>
                    <div className="text-icon-error">
                      <Package className="h-4 w-4" />
                    </div>
                    <p className="text-sm text-text-error">
                      {t('substitution.availableDescription', { available: 0, total: item.quantity })}
                    </p>
                  </>
                )
              ) : (
                // Loading or no availability data
                <>
                  <div className="text-icon-success">
                    <Package className="h-4 w-4" />
                  </div>
                  <p className="text-sm text-text-success">{t('available')}</p>
                </>
              )}
            </div>
            {showQty && (
              <Button
                variant="link"
                size="small"
                className="normal-case text-sm tracking-normal p-0 justify-start gap-2"
                onClick={handleAddToWishlist}
                disabled={!item.product?.id || isAddingToWishlist}
                aria-busy={isAddingToWishlist || undefined}
                data-testid={`cart-item-add-to-wishlist-${item.product?.id}`}
              >
                {isAddingToWishlist && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                {t('addToWishlist')}
              </Button>
            )}
          </div>
        </div>
        {!showQty && (
          <p className="hidden text-sm sm:col-start-3 sm:row-start-1 sm:grid">
            <span className="invisible col-start-1 row-start-1 whitespace-nowrap" aria-hidden>
              {widestQtyLabel}
            </span>
            <span className="col-start-1 row-start-1 whitespace-nowrap">{qtyLabel}</span>
          </p>
        )}
        {showQty && (
          <div className="col-start-2 row-start-4 sm:col-start-3 sm:col-end-3 sm:row-start-1 md:col-start-3 flex gap-4 ml-4 mt-4 sm:ml-0 sm:mt-0">
            <div className="w-full flex">
              {quantity <= 1 ? (
                <Button
                  variant="secondary"
                  size="icon"
                  className="p-3 h-13 border-border-primary rounded-none rounded-ss-sm rounded-es-sm"
                  disabled={loading}
                  onClick={handleRemoveItem}
                  data-testid={`cart-item-remove-${item.product?.id}`}
                >
                  <Trash2 className="h-6 w-6" />
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="icon"
                  className="p-3 h-13 border-border-primary rounded-none rounded-ss-sm rounded-es-sm"
                  disabled={loading}
                  onClick={() => handleUpdateQuantity(quantity - 1)}
                  data-testid={`cart-item-decrease-${item.product?.id}`}
                >
                  <Minus className="h-6 w-6" />
                </Button>
              )}
              <div className="w-15 h-13 border-y border-border-primary">
                {loading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <Spinner color="primary" variant="sm" />
                  </div>
                ) : (
                  <div className="relative">
                    <Input
                      value={quantity}
                      className="py-3 text-center border-none"
                      onChange={(e) => onChangeQty(e)}
                      data-testid={`cart-item-quantity-${item.product?.id}`}
                    />
                    {substitution && (
                      <div className="cursor-pointer" onClick={() => setShowSubstitutionModal(true)}>
                        <UINotification icon={Package} iconSize={24} animate="pulse" className="absolute" />
                      </div>
                    )}
                  </div>
                )}
              </div>
              <Button
                variant="secondary"
                size="icon"
                className="p-3 h-13 border-border-primary rounded-none rounded-ee-sm rounded-se-sm"
                disabled={loading}
                onClick={() => handleUpdateQuantity(quantity + 1)}
                data-testid={`cart-item-increase-${item.product?.id}`}
              >
                <Plus className="h-6 w-6" />
              </Button>
            </div>
          </div>
        )}
        <CartItemPriceColumn
          item={item}
          grossLabel={t('gross')}
          priceChange={priceChange}
          onOpenPriceChange={() => setShowPriceChangeModal(true)}
        />
      </div>

      {/* Modals */}
      {substitution && (
        <SubstitutionModal
          isOpen={showSubstitutionModal}
          onClose={() => setShowSubstitutionModal(false)}
          cartItem={item}
          substitution={substitution}
          onDone={onSubstitutionDone}
        />
      )}
      {priceChange && (
        <ItemPriceChangeModal
          isOpen={showPriceChangeModal}
          onClose={() => setShowPriceChangeModal(false)}
          cartItem={item}
          priceChange={priceChange}
          onDone={onItemPriceChangeDone}
        />
      )}
      {loginDialog}
    </div>
  );
}
