'use client';

import { useEffect, useState, useTransition } from 'react';
import { signIn, signOut, useSession as useNextAuthSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { getPathname } from '@/i18n/navigation';
import { clearUnscopedAIHelperStorage } from '@/lib/client/ai-helper-storage';
import { redirectToLoginSuccess } from '@/lib/client/auth-login-success-redirect';
import { getLogger } from '@/lib/logger/use-logger-client';
import { useCartStore } from '@/providers/StoreProvider';
import { clearAllPersistedStores } from '@/utils/storeUtils';
import { useCheckout } from '../checkout/useCheckout';
import { useSession as useShopSession } from '../session/useSession';
import { useSite } from '../site/useSite';

interface AuthenticationHook {
  isAuthenticated: boolean;
  error: Error | null;
  loading: boolean;
  login: (username: string, password: string, callbackUrl?: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

/**
 * Hook for authentication functionality
 * @returns Authentication state and functions
 */
export const useAuthentication = (): AuthenticationHook => {
  const locale = useLocale();
  const { site } = useSite();
  const session = useNextAuthSession({
    required: true,
    onUnauthenticated: () => {
      setIsAuthenticated(false);
      setLoading(false);
    },
  });

  // State for authentication status and user data
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(session.status === 'authenticated');
  const [loading, setLoading] = useState<boolean>(session.status === 'loading');
  const [error, setError] = useState<Error | null>(null);
  const { reset } = useCheckout();
  const { refreshSession } = useShopSession();
  const { clearCart } = useCartStore();
  const [_isPending, startTransition] = useTransition();
  const logger = getLogger();

  // Update authentication state when session status changes
  useEffect(() => {
    setIsAuthenticated(session.status === 'authenticated');
    setLoading(session.status === 'loading');
    // Since the session object itself is stable, we only need to watch the status property
  }, [session.status]);

  const refreshClientSessionState = async (): Promise<void> => {
    try {
      await session.update();
    } catch (refreshError) {
      logger.warn(
        {
          err: refreshError instanceof Error ? refreshError.message : refreshError ? String(refreshError) : undefined,
        },
        'Failed to refresh NextAuth session after non-redirect login',
      );
    }

    try {
      await refreshSession();
    } catch (refreshError) {
      logger.warn(
        {
          err: refreshError instanceof Error ? refreshError.message : refreshError ? String(refreshError) : undefined,
        },
        'Failed to refresh storefront session after non-redirect login',
      );
    }
  };

  const login = async (username: string, password: string, callbackUrl?: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    let success = false;
    // Validate callbackUrl to prevent open redirect attacks
    const safeCallbackUrl = callbackUrl
      ? callbackUrl.startsWith('/') && !callbackUrl.startsWith('//')
        ? callbackUrl
        : '/account'
      : undefined;
    try {
      const data = await signIn('credentials', {
        username,
        password,
        redirect: false,
        redirectTo: safeCallbackUrl ? safeCallbackUrl + '?login=success' : undefined,
      });

      if (data?.error) {
        setError(new Error(data.error));
        setIsAuthenticated(false);
      } else {
        setIsAuthenticated(true);
        // Drop leftover unscoped Helper keys before the dashboard mounts.
        // Other shoppers' namespaced keys are pruned when the Helper adopts the new customer id.
        clearUnscopedAIHelperStorage();
        // Clear Zustand cart state only — do NOT clear server session.
        // The server-side merge in EmporixAuthService.login() has already
        // set sessionService.setCart(customerCartId) with the merged cart.
        // A server-side clear here would wipe that reference.
        clearCart({ clearSession: false });
        reset();

        if (safeCallbackUrl) {
          await redirectToLoginSuccess(safeCallbackUrl, locale);
        } else {
          await refreshClientSessionState();
        }
        success = true;
      }
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to log in'));
    } finally {
      setLoading(false);
    }
    return success;
  };

  const logout = async (): Promise<void> => {
    try {
      setLoading(true);
      startTransition(async () => {
        // Clear cart state (client + server-side session)
        clearCart();
        // Clear all persisted store data (localStorage)
        clearAllPersistedStores();

        const logoutTarget = getPathname({ href: '/', locale, site: site?.code });
        // ...then log out (no idea how this could fail)
        await signOut({
          redirect: true,
          redirectTo: logoutTarget,
        });
      });
    } catch (error) {
      setError(error instanceof Error ? error : new Error('Failed to log out'));
    } finally {
      setLoading(false);
    }
  };

  return {
    isAuthenticated,
    error,
    loading,
    login,
    logout,
  };
};

export default useAuthentication;
