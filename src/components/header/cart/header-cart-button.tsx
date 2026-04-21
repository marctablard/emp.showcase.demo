'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Cart } from '@platform/services/model/cart';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { InfoIcon, ShoppingCart } from 'lucide-react';
import { HeaderMiniCartContent } from '@/components/header/cart/header-mini-cart-content';
import { Badge } from '@/components/ui/badge';
import UiLink from '@/components/ui/link';
import { UINotification } from '@/components/ui/molecules/ui-notification';
import { Spinner } from '@/components/ui/spinner';
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/cart/useCart';
import { useCartTotal } from '@/hooks/cart/useCartTotal';
import { useGlobalSyncReady } from '@/hooks/common/useGlobalSyncReady';
import { useShopContextReady } from '@/hooks/common/useShopContextReady';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn, formatCurrency } from '@/lib/utils';
import type { StorefrontNotification } from '@/platform/services/model/notification/notification';

interface HeaderCartButtonProps {
  initialCart?: Cart | null;
  showSum?: boolean;
}

function HeaderCartButtonContent({ initialCart, showSum = true }: HeaderCartButtonProps) {
  const t = useTranslations('layout.header');
  const { cartTotal, currency } = useCartTotal();
  // Pass initialCart directly to useCart to skip loading
  const { cart, loading } = useCart(initialCart);
  const { ready: shopContextReady } = useShopContextReady({ requireCart: true });
  const { ready: globalSyncReady } = useGlobalSyncReady();
  const showSpinner = loading || !shopContextReady || !globalSyncReady;
  const [scrollHeight, setScrollHeight] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const scrollContainer = useRef<HTMLDivElement>(null);
  const isAboveSmallScreen = useBreakpoint('sm');
  const isAboveMediumScreen = useBreakpoint('md');
  const [notifications, setNotifications] = useState<StorefrontNotification[]>([]);

  const { registerNotificationListener, unregisterNotificationListener } = useNotifications();

  // Store subscription ID for cleanup
  const subscriptionIdRef = useRef<string | null>(null);
  // Register for cart notifications on mount
  useEffect(() => {
    // @see https://react.dev/reference/react-dom/client/hydrateRoot#handling-different-client-and-server-content
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);

    // Handler for cart notifications
    const handleCartNotification = (notification: StorefrontNotification | string) => {
      if (typeof notification === 'string') {
        // Remove notification with matching ID from state
        setNotifications((prev) => prev.filter((item) => item.id !== notification));
        return true;
      }
      getLogger().debug({ notification }, 'headerCartButton notification');
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

  const renderButton = () => (
    <UiLink
      type="Link"
      variant="buttonPrimary"
      href="/cart"
      aria-label={t('viewCart')}
      className="pl-[11px] sm:pl-4 pr-1 pb-2 pt-1 sm:py-1"
    >
      {showSum && isAboveSmallScreen && (
        <span
          className="text-text-on-action text-lg tabular-nums min-w-[3ch] inline-block"
          aria-busy={showSpinner || undefined}
        >
          {showSpinner ? '\u00A0' : formatCurrency(cartTotal || 0.0, currency)}
        </span>
      )}
      <div className={cn('flex items-center w-[43px] h-[35px] relative', isClient ? '' : 'justify-center')}>
        {isClient ? (
          <>
            <Badge
              variant="white"
              rounded="full"
              className="h-5 min-w-5 px-1 tabular-nums tracking-normal absolute top-0 right-0"
            >
              {showSpinner ? (
                <Spinner color="primary" variant="xs" />
              ) : (
                cart?.items.reduce((acc, item) => acc + item.quantity, 0) || 0
              )}
            </Badge>
            <ShoppingCart width="32" height="32" />
          </>
        ) : (
          <Spinner color="white" variant="sm" />
        )}
      </div>

      {/* Notification icon that appears only when hasNotifications is true */}
      {notifications.length > 0 && (
        <UINotification icon={InfoIcon} iconSize={24} className="bottom-[-48px] right-0 absolute" animate="pulse" />
      )}
    </UiLink>
  );

  return (
    <Tooltip onOpenChange={openChange}>
      {isAboveMediumScreen ? (
        <>
          <TooltipTrigger asChild>
            <span className="inline-flex">{renderButton()}</span>
          </TooltipTrigger>
          <TooltipPrimitive.Portal>
            <TooltipPrimitive.Content
              data-slot="tooltip-content"
              sideOffset={24}
              alignOffset={-24}
              align="end"
              side="bottom"
              className="[@media(pointer:coarse)]:hidden backdrop-blur-default bg-surface-page/90 shadow-xl pl-4 pb-4 pt-0 pr-0 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) border-width-notification rounded-notification"
            >
              <HeaderMiniCartContent
                loading={showSpinner}
                cart={cart}
                scrollHeight={scrollHeight}
                scrollContainer={scrollContainer}
              />
            </TooltipPrimitive.Content>
          </TooltipPrimitive.Portal>
        </>
      ) : (
        renderButton()
      )}
    </Tooltip>
  );
}

export function HeaderCartButton({ initialCart, showSum = true }: HeaderCartButtonProps) {
  return (
    <Suspense
      fallback={
        <div className="relative pl-[11px] sm:pl-4 pr-1 pb-2 pt-1 sm:py-1 self-center bg-surface-action text-text-on-action border border-transparent rounded-button inline-flex items-center justify-center gap-3 whitespace-nowrap px-4 py-3">
          <div className="flex items-center w-[43px] h-[35px] relative">
            <Badge variant="white" rounded="full" className="h-5 min-w-5 px-1 absolute top-0 right-0">
              <Spinner color="primary" variant="xs" />
            </Badge>
            <ShoppingCart width="32" height="32" />
          </div>
        </div>
      }
    >
      <HeaderCartButtonContent initialCart={initialCart} showSum={showSum} />
    </Suspense>
  );
}
