'use client';

import { useEffect, useState, useTransition } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { getPathname } from '@/i18n/navigation';
import { fetchCurrentSession } from '@/lib/client/session';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { getLogger } from '@/lib/logger/use-logger-client';
import { useCartStore } from '@/providers/StoreProvider';
import { clearAllPersistedStores } from '@/utils/storeUtils';
import { useCheckout } from '../checkout/useCheckout';
import { useSite } from '../site/useSite';

const LOGIN_SUCCESS_QUERY_PARAM = '?login=success';
const CANONICAL_SESSION_FETCH_RETRY_COUNT = 3;
const CANONICAL_SESSION_FETCH_RETRY_DELAY_MS = 250;
const DEFAULT_SITE_CODE = process.env.NEXT_PUBLIC_DEFAULT_SITE || 'main';
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
  const session = useSession({
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
  const { clearCart } = useCartStore();
  const [_isPending, startTransition] = useTransition();
  const logger = getLogger();

  // Update authentication state when session status changes
  useEffect(() => {
    setIsAuthenticated(session.status === 'authenticated');
    setLoading(session.status === 'loading');
    // Since the session object itself is stable, we only need to watch the status property
  }, [session.status]);

  const getCanonicalSiteCode = async (): Promise<string> => {
    let lastError: unknown = null;
    let canonicalSiteCode: string | null = null;

    for (let attempt = 0; attempt < CANONICAL_SESSION_FETCH_RETRY_COUNT; attempt++) {
      try {
        const canonicalSession = await fetchCurrentSession(true);
        const hasAuthenticatedCustomer = isAuthenticatedSessionCustomerId(canonicalSession?.customerId);
        if (canonicalSession?.siteCode && hasAuthenticatedCustomer) {
          canonicalSiteCode = canonicalSession.siteCode;
          break;
        }
      } catch (error) {
        lastError = error;
      }

      if (attempt < CANONICAL_SESSION_FETCH_RETRY_COUNT - 1) {
        await new Promise((resolve) => setTimeout(resolve, CANONICAL_SESSION_FETCH_RETRY_DELAY_MS));
      }
    }

    if (!canonicalSiteCode) {
      logger.warn(
        {
          err: lastError instanceof Error ? lastError.message : lastError ? String(lastError) : undefined,
          fallbackSiteCode: DEFAULT_SITE_CODE,
        },
        'Post-login canonical session fetch failed after retries, using default site redirect',
      );
      return DEFAULT_SITE_CODE;
    }

    return canonicalSiteCode;
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
        // Clear Zustand cart state only — do NOT clear server session.
        // The server-side merge in EmporixAuthService.login() has already
        // set sessionService.setCart(customerCartId) with the merged cart.
        // A server-side clear here would wipe that reference.
        clearCart({ clearSession: false });
        reset();

        if (safeCallbackUrl) {
          const postLoginHref = safeCallbackUrl + LOGIN_SUCCESS_QUERY_PARAM;
          const canonicalSiteCode = await getCanonicalSiteCode();
          const redirectPath = getPathname({
            href: postLoginHref,
            locale,
            site: canonicalSiteCode,
            forcePrefix: true,
          });
          window.location.href = redirectPath;
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
