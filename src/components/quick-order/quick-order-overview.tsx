'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { Loader2, LockKeyhole } from 'lucide-react';
import LoginDialog from '@/components/login/login-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { H5 } from '@/components/ui/h';
import { useCart } from '@/hooks/cart/useCart';
import type { QuickOrderItem } from '@/hooks/quick-order/useQuickOrderList';
import { formatCurrency } from '@/lib/utils';

interface QuickOrderOverviewProps {
  items: QuickOrderItem[];
  netSubtotal: number;
  grossSubtotal: number;
  vatTotal: number;
  currency: string;
  onAddToCart: () => Promise<void>;
  onGoToCheckout: () => Promise<void>;
  isProcessing: boolean;
}

export function QuickOrderOverview({
  items,
  netSubtotal,
  grossSubtotal,
  vatTotal,
  currency,
  onAddToCart,
  onGoToCheckout,
  isProcessing,
}: QuickOrderOverviewProps) {
  const t = useTranslations('quick-order.overview');
  const { status: sessionStatus } = useSession();
  const { refetch: fetchCart } = useCart();

  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);
  const awaitingAuthRef = useRef(false);

  const isDisabled = items.length === 0 || isProcessing;
  const isAuthenticated = sessionStatus === 'authenticated';

  // Execute pending action when user successfully authenticates via the login dialog
  useEffect(() => {
    if (isAuthenticated && awaitingAuthRef.current && pendingActionRef.current) {
      awaitingAuthRef.current = false;
      const pending = pendingActionRef.current;
      pendingActionRef.current = null;
      const run = async (): Promise<void> => {
        await fetchCart();
        await pending();
      };
      void run();
    }
  }, [isAuthenticated, fetchCart]);

  const handleAction = useCallback(
    (action: () => Promise<void>) => {
      if (!isAuthenticated) {
        pendingActionRef.current = action;
        awaitingAuthRef.current = true;
        setLoginDialogOpen(true);
        return;
      }
      void action();
    },
    [isAuthenticated],
  );

  const handleLoginDialogClose = useCallback(() => {
    setLoginDialogOpen(false);
    pendingActionRef.current = null;
    awaitingAuthRef.current = false;
  }, []);

  const handleLoginSuccess = useCallback(() => {
    setLoginDialogOpen(false);
    const pending = pendingActionRef.current;
    if (pending) {
      pendingActionRef.current = null;
      awaitingAuthRef.current = false;
      const run = async (): Promise<void> => {
        await fetchCart();
        await pending();
      };
      void run();
    }
  }, [fetchCart]);

  return (
    <>
      <Card className="bg-surface-action-hover-2 p-6 border-none gap-4 shadow-sm w-full">
        <CardHeader className="p-0">
          <CardTitle>
            <H5>{t('title')}</H5>
          </CardTitle>
        </CardHeader>
        <CardContent className="bg-surface-page rounded-md p-4">
          <div className="space-y-4">
            <div className="flex justify-between">
              <span>{t('valueOfGoods')}</span>
              <span>{formatCurrency(grossSubtotal, currency)}</span>
            </div>

            <div className="flex justify-between pt-4 border-t border-border-primary">
              <span>{t('netValue')}</span>
              <span className="font-bold font-headlines">{formatCurrency(netSubtotal, currency)}</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-base">
                <span>{t('vat')}</span>
                <span className={vatTotal > 0 ? '' : 'text-text-placeholders'}>
                  {vatTotal > 0 ? formatCurrency(vatTotal, currency) : t('calculatedAtCheckout')}
                </span>
              </div>
              <div className="flex justify-between text-base">
                <span>{t('shippingCosts')}</span>
                <span className="text-text-placeholders">{t('calculatedAtCheckout')}</span>
              </div>
            </div>

            <div className="flex justify-between font-bold font-headlines text-lg">
              <span>{t('total')}</span>
              <span>{formatCurrency(grossSubtotal, currency)}</span>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 p-0">
          <Button
            variant="secondary"
            className="w-full font-headlines tracking-[2px]"
            disabled={isDisabled}
            onClick={() => void onAddToCart()}
            data-testid="quick-order-add-to-cart"
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('addToCart')}
          </Button>
          <Button
            variant="primary"
            className="w-full font-headlines tracking-[2px]"
            disabled={isDisabled}
            onClick={() => handleAction(onGoToCheckout)}
            data-testid="quick-order-go-to-checkout"
          >
            {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t('goToCheckout')}
          </Button>
          <div className="flex items-center gap-2 text-text-on-disabled pt-2">
            <LockKeyhole width={12} />
            <span className="text-sm leading-6">{t('secureTransmission')}</span>
          </div>
        </CardFooter>
      </Card>

      <LoginDialog
        open={loginDialogOpen}
        onCloseAction={handleLoginDialogClose}
        onLoginSuccess={handleLoginSuccess}
        onGuestAction={handleLoginSuccess}
        guestCheckout
      />
    </>
  );
}
