import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Cart } from '@platform/services/model/cart';
import { InfoIcon, ShoppingCart } from 'lucide-react';
import { HeaderMiniCartContent } from '@/components/header/cart/header-mini-cart-content';
import { Badge } from '@/components/ui/badge';
import { UINotification } from '@/components/ui/molecules/ui-notification';
import { Spinner } from '@/components/ui/spinner';
import { MiniCartTooltipContent, Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotal } from '@/hooks/cart/useCartTotal';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useRouter } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import { StorefrontNotification } from '@/platform/services/model/notification/notification';

interface HeaderCartButtonProps {
  initialCart?: Cart | null;
  showSum?: boolean;
}

export function HeaderCartButton({ initialCart, showSum = true }: HeaderCartButtonProps) {
  const t = useTranslations('layout.header');
  const router = useRouter();
  const { cartTotal, currency } = useCartTotal();
  // Pass initialCart directly to useCart to skip loading
  const { cart, loading } = useCart(initialCart);
  const [scrollHeight, setScrollHeight] = useState(false);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const isAboveSmallScreen = useBreakpoint('sm');
  const [notifications, setNotifications] = useState<StorefrontNotification[]>([]);

  const { registerNotificationListener, unregisterNotificationListener } = useNotifications();

  // Store subscription ID for cleanup
  const subscriptionIdRef = useRef<string | null>(null);
  // Register for cart notifications on mount
  useEffect(() => {
    // Handler for cart notifications
    const handleCartNotification = (notification: StorefrontNotification | string) => {
      if (typeof notification === 'string') {
        // Remove notification with matching ID from state
        setNotifications((prev) => prev.filter((item) => item.id !== notification));
        return true;
      }
      console.log('headerCartButton notification', notification);
      if (notification.recipient_id !== cart?.id) {
        return false;
      }
      setNotifications((prev) => [...prev, notification]);
      // Mark as consumed to prevent toast display
      //markNotificationAsConsumed(notification.id);

      // Return true to indicate this notification was consumed
      return false;
    };

    // Register for CART notifications
    subscriptionIdRef.current = registerNotificationListener('CART', handleCartNotification);

    // Cleanup on unmount
    return () => {
      if (subscriptionIdRef.current) {
        unregisterNotificationListener(subscriptionIdRef.current);
        subscriptionIdRef.current = null;
      }
    };
  }, [registerNotificationListener, unregisterNotificationListener, cart?.id]);

  const openChange = () => {
    setTimeout(() => {
      if (scrollContainer?.current?.offsetHeight && scrollContainer?.current?.offsetHeight >= 300) {
        setScrollHeight(true);
      } else {
        setScrollHeight(false);
      }
    }, 100);
  };

  return (
    <Tooltip onOpenChange={openChange}>
      <TooltipTrigger
        aria-label={t('viewCart')}
        className="relative pl-[11px] sm:pl-4 pr-1 pb-2 pt-1 sm:py-1 self-center bg-surface-action text-text-on-action border border-transparent hover:bg-surface-action-hover rounded-button cursor-pointer uppercase inline-flex items-center justify-center gap-3 whitespace-nowrap px-4 py-3 text-base/6 tracking-widest font-bold transition-all disabled:pointer-events-none disabled:bg-surface-disabled disabled:text-text-on-disabled [&_svg]:pointer-events-none shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-border-focus focus-visible:ring-offset-2 focus-visible:ring-offset-white"
        onClick={() => router.push('/cart')}
      >
        {showSum && isAboveSmallScreen && (
          <span className="text-text-on-action text-lg">{formatCurrency(cartTotal || 0.0, currency)}</span>
        )}
        <div className="flex items-center w-[43px] h-[35px] relative">
          <Badge
            variant="white"
            rounded="full"
            className="h-5 min-w-5 px-1 tabular-nums tracking-normal absolute top-0 right-0"
          >
            {loading ? (
              <Spinner color="primary" variant="xs" />
            ) : (
              cart?.items.reduce((acc, item) => acc + item.quantity, 0) || 0
            )}
          </Badge>
          <ShoppingCart width="32" height="32" />
        </div>

        {/* Notification icon that appears only when hasNotifications is true */}
        {notifications.length > 0 && (
          <UINotification icon={InfoIcon} iconSize={24} className="bottom-[-48px] right-0 absolute" animate="pulse" />
        )}
      </TooltipTrigger>
      <MiniCartTooltipContent sideOffset={24}>
        <HeaderMiniCartContent
          loading={loading}
          cart={cart}
          scrollHeight={scrollHeight}
          scrollContainer={scrollContainer}
        />
      </MiniCartTooltipContent>
    </Tooltip>
  );
}
