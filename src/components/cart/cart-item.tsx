'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { Coins, Minus, Package, Plus, ShoppingCart, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import { UINotification } from '@/components/ui/molecules/ui-notification';
import { useCart } from '@/hooks/cart/useCart';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useAvailability } from '@/hooks/product/useAvailability';
import { useL10n } from '@/hooks/useL10n';
import { cn, formatCurrency } from '@/lib/utils';
import type { Cart, CartItem, CartItemPriceChange, CartItemSubstitution } from '@/platform/services/model/cart/cart.d';
import type { StorefrontNotification } from '@/platform/services/model/notification/notification';
import { Input } from '../ui/input';
import { Spinner } from '../ui/spinner';
import { ItemPriceChangeModal } from './item-price-change-modal';
import { SubstitutionModal } from './substitution-modal';

interface CartItemProps {
  cart: Cart;
  item: CartItem;
  showQty?: boolean;
}

export function CartItemRow({ cart, item, showQty }: CartItemProps) {
  const { l10n } = useL10n();
  const t = useTranslations('cart');
  const { updateItemQuantity, removeItem, loading } = useCart(cart);
  const [isProcessing, setIsProcessing] = useState(false);
  const [quantity, setQuantity] = useState(item.quantity);
  const isStrike = false;
  const { registerNotificationListener, unregisterNotificationListener, markNotificationAsRead } = useNotifications();
  const [substitution, setSubstitution] = useState<CartItemSubstitution | null>(null);
  const [substitutionNotificationId, setSubstitutionNotificationId] = useState<string | null>(null);
  const [showSubstitutionModal, setShowSubstitutionModal] = useState(false);
  const [priceChange, setPriceChange] = useState<CartItemPriceChange | null>(null);
  const [priceChangeNotificationId, setPriceChangeNotificationId] = useState<string | null>(null);
  const [showPriceChangeModal, setShowPriceChangeModal] = useState(false);
  const { availability } = useAvailability(item.product?.id);

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

  useEffect(() => {
    if (item.quantity != quantity) {
      setQuantity(item.quantity);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.quantity]);

  // Handle quantity update
  const handleUpdateQuantity = async (newQuantity: number) => {
    if (newQuantity < 1 || isProcessing) return;
    setIsProcessing(true);
    try {
      setQuantity(newQuantity);
      await updateItemQuantity(item.id, newQuantity);
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
      await removeItem(item.id);
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

  return (
    <div className="py-6 first:border-none border-t border-border-primary sm:first:border-solid">
      <div className="grid grid-cols-[1fr_2fr] sm:grid-cols-[120px_2fr_1fr_1fr] md:grid-cols-[120px_3fr_1fr_1fr]">
        <div className="col-start-1 row-start-2 sm:row-start-1 row-end-3">
          <div className="rounded-ss-md rounded-ee-md w-[100px] h-[65px] sm:w-[120px] sm:h-[78px] object-fit overflow-hidden">
            {item.product && item.product.images?.length ? (
              <Image
                width={100}
                height={65}
                src={String(item.product.images[0].url)}
                alt={String(item.product.name || 'Product')}
                className="rounded-ss-[inherit] rounded-ee-[inherit] w-[100px] h-[65px] sm:w-[120px] sm:h-[78px]"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-icon-secondary">
                <ShoppingCart className="h-8 w-8 opacity-30" />
              </div>
            )}
          </div>
        </div>
        <div className="col-start-1 col-end-3 row-start-1 sm:col-start-2 flex flex-col gap-1 mb-4 sm:mb-0 sm:mx-4">
          <p className="text-sm sm:text-base">{l10n(item.product?.brand?.name || '')}</p>
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
            'row-start-3 col-start-2 sm:col-end-2 flex flex-col gap-2 sm:row-start-2 mx-4 pt-2',
            !isStrike && showQty && '-mt-4 sm:-mt-0',
          )}
        >
          {!showQty ? (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
              <p className="text-sm sm:border-r border-border-primary sm:pr-4">
                {t('itemNumber')}: {item.product?.id}
              </p>
              <p className="text-sm sm:pl-4">
                {t('qty')}: {item.quantity}
              </p>
            </div>
          ) : (
            <p className="text-sm">
              {t('itemNumber')}: {item.product?.id}
            </p>
          )}
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
            <Button variant="link" size="small" className="normal-case text-sm tracking-normal p-0 justify-start">
              {t('addToWishlist')}
            </Button>
          )}
        </div>
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
        <div className="col-start-2 row-start-2 sm:col-start-4 sm:row-start-1 sm:row-end-3 md:col-start-4 flex flex-col gap-1 ps-4 sm:ps-0">
          {item.price.originalAmount && item.price.originalAmount !== item.price.amount && (
            <p className="line-through sm:text-end text-text-error">
              {formatCurrency(item.price.originalAmount, item.price.currency)}
            </p>
          )}
          <div className="font-bold sm:text-end relative">
            {formatCurrency(item.tax?.netValue || item.price.amount, item.price.currency)}
            {priceChange && (
              <div className="cursor-pointer" onClick={() => setShowPriceChangeModal(true)}>
                <UINotification
                  icon={Coins}
                  iconSize={18}
                  className="bottom-[-58px] right-[52px] absolute"
                  animate="pulse"
                />
              </div>
            )}
          </div>
          {item.tax?.netValue && (
            <span className="text-sm text-text-on-disabled sm:text-end">
              {t('gross')}
              {formatCurrency(item.tax?.grossValue, item.price.currency)}
            </span>
          )}
        </div>
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
    </div>
  );
}
