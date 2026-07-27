import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import type { Cart, CartItem } from '@platform/services/model/cart';
import { Coins, Package, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useL10n } from '@/hooks/useL10n';
import { useRouter } from '@/i18n/navigation';
import { getLogger } from '@/lib/logger/use-logger-client';
import { formatCurrency } from '@/lib/utils';
import type { StorefrontNotification } from '@/platform/services/model/notification/notification';

interface HeaderMiniCartItemListProps {
  cart?: Cart | null;
}

export function HeaderMiniCartItemList({ cart }: HeaderMiniCartItemListProps) {
  const t = useTranslations('cart');
  const { registerNotificationListener, unregisterNotificationListener } = useNotifications();
  const { l10n } = useL10n();
  const router = useRouter();
  const [notifications, setNotifications] = useState<StorefrontNotification[]>([]);
  // Handler for cart notifications
  const handleCartNotification = useCallback(
    (notification: StorefrontNotification | string) => {
      getLogger().debug({ notification }, 'Cart notification received');
      if (typeof notification === 'string') {
        // Remove notification with matching ID from state
        setNotifications((prev) => prev.filter((item) => item.id !== notification));
        return true;
      }
      if (notification.recipient_id !== cart?.id) {
        return false;
      }
      setNotifications((prev) => [...prev, notification]);
      // Mark as consumed to prevent toast display
      //markNotificationAsConsumed(notification.id);

      // Return true to indicate this notification was consumed
      return false;
    },
    [cart?.id, setNotifications],
  );

  const getCartItemSubstitutions = (cartItem: CartItem) => {
    return notifications.filter(
      (notification) =>
        notification.code === 'SUBSTITUTION_AVAILABLE' && notification.data_json.productId === cartItem.product?.id,
    );
  };

  const getCartItemPriceChanges = (cartItem: CartItem) => {
    return notifications.filter(
      (notification) =>
        notification.code === 'ITEM_PRICE_CHANGE' && notification.data_json.productId === cartItem.product?.id,
    );
  };

  // Register for cart notifications on mount
  useEffect(() => {
    const subscriptionId = registerNotificationListener('CART', handleCartNotification);
    return () => {
      unregisterNotificationListener(subscriptionId);
    };
  }, [registerNotificationListener, unregisterNotificationListener, handleCartNotification]);

  return (
    <>
      {cart?.items?.map((item) => (
        <div key={item.id} className="pt-4 first:pt-0 pb-4 border-b flex items-end justify-between gap-3">
          <div className="flex gap-4">
            <div className="rounded-ss-md rounded-ee-md w-[100px] h-[65px] object-fit overflow-hidden">
              {item.product && item.product.images?.length ? (
                <Image
                  width={100}
                  height={65}
                  src={String(item.product.images[0].url)}
                  alt={l10n(item.product.name || 'Product')}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-icon-secondary">
                  <ShoppingCart className="h-6 w-6 opacity-30" />
                </div>
              )}
            </div>
            <div className="flex-grow min-w-0">
              <p className="text-sm">{l10n(item.product?.brand?.name || '')}</p>
              <p
                className="font-bold truncate font-headlines cursor-pointer"
                onClick={() => router.push(`/product/${item.product?.id}`)}
              >
                {l10n(item.product?.name || 'Product')}
              </p>
              <div className="flex items-center">
                <p className="text-sm border-r border-border-primary pr-4">
                  {t('itemNumber')}: {item.product?.id}
                </p>
                <p className="text-sm pl-4">
                  <span
                    className={`${getCartItemSubstitutions(item).length > 0 ? 'bg-surface-warning rounded-full px-1' : ''}`}
                  >
                    {t('qty')}: {item.quantity}
                  </span>
                </p>
                {getCartItemSubstitutions(item).length > 0 && (
                  <Badge variant="warning" className="h-5 min-w-5 ml-2 rounded-full px-1 tabular-nums tracking-normal">
                    <Package />
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div>
            <p className="flex items-center font-bold font-headlines">
              {getCartItemPriceChanges(item).length > 0 && (
                <Badge
                  variant="warning"
                  className="h-5 min-w-5 rounded-full px-1 tabular-nums tracking-normal float-left mr-2"
                >
                  <Coins />
                </Badge>
              )}
              <span
                className={`${getCartItemPriceChanges(item).length > 0 ? 'bg-surface-warning rounded-full px-1' : ''}`}
              >
                {formatCurrency(item.price.amount, item.price.currency)}
              </span>
            </p>
          </div>
        </div>
      ))}
    </>
  );
}
