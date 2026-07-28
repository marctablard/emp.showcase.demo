'use client';

import { type ReactElement, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LoginDialog } from '@/components/login';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useWishlist } from '@/hooks/wishlist/useWishlist';
import { getLogger } from '@/lib/logger/use-logger-client';

interface UseWishlistAddWithAuthResult {
  addToWishlist: (productId: string, quantity: number) => void;
  isAdding: boolean;
  loginDialog: ReactElement;
}

/**
 * Adds a product to the wishlist with an inline login flow for anonymous users.
 
 */
export function useWishlistAddWithAuth(): UseWishlistAddWithAuthResult {
  const { addItem } = useWishlist();
  const { status: sessionStatus } = useSession();
  const t = useTranslations('account.wishlist.notifications');
  const [loginDialogOpen, setLoginDialogOpen] = useState(false);
  const [pendingAdd, setPendingAdd] = useState<{ productId: string; quantity: number } | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const runAdd = async (productId: string, quantity: number) => {
    setIsAdding(true);
    try {
      await addItem(productId, quantity);
    } catch (error) {
      getLogger().error({ err: error, productId }, 'Failed to add product to wishlist');
      notify({ title: t('addError'), type: ToastType.Error });
    } finally {
      setIsAdding(false);
    }
  };

  const addToWishlist = (productId: string, quantity: number) => {
    if (sessionStatus === 'unauthenticated') {
      setPendingAdd({ productId, quantity });
      setLoginDialogOpen(true);
      return;
    }
    void runAdd(productId, quantity);
  };

  const handleLoginSuccess = () => {
    setLoginDialogOpen(false);
    const intent = pendingAdd;
    setPendingAdd(null);
    if (intent) void runAdd(intent.productId, intent.quantity);
  };

  const handleDialogClose = () => {
    setLoginDialogOpen(false);
    setPendingAdd(null);
  };

  const loginDialog = (
    <LoginDialog
      open={loginDialogOpen}
      callbackUrl=""
      onLoginSuccess={handleLoginSuccess}
      onCloseAction={handleDialogClose}
    />
  );

  return { addToWishlist, isAdding, loginDialog };
}
