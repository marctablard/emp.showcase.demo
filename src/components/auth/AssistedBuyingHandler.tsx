'use client';

import { useEffect, useRef } from 'react';
import { signIn } from 'next-auth/react';
import {
  ASSISTED_BUYING_CREDENTIAL_FLAG,
  ASSISTED_BUYING_SIGN_IN_PARAM,
  buildAssistedBuyingProcessUrl,
  parseAssistedBuyingTokenParams,
  stripAssistedBuyingParamsFromSearchParams,
} from '@/lib/common/assisted-buying';
import { getLogger } from '@/lib/logger/use-logger-client';

let clientSignInInFlight = false;

/**
 * Assisted buying handoff from Management Dashboard.
 *
 * 1. Tokens in the URL → navigate to GET `/api/auth/assisted-buying/process` (server login).
 * 2. `abSignIn=1` in the URL → client NextAuth sign-in fallback if server sign-in failed.
 */
export function AssistedBuyingHandler() {
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || typeof window === 'undefined') {
      return;
    }

    const params = new URLSearchParams(window.location.search);

    if (params.get(ASSISTED_BUYING_SIGN_IN_PARAM) === '1') {
      if (clientSignInInFlight) {
        return;
      }

      startedRef.current = true;
      clientSignInInFlight = true;

      const buildCleanUrl = () => {
        stripAssistedBuyingParamsFromSearchParams(params);
        const query = params.toString();
        return `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
      };

      void (async () => {
        try {
          const signInResult = await signIn('credentials', {
            username: 'assisted-buying',
            password: '',
            assistedBuying: ASSISTED_BUYING_CREDENTIAL_FLAG,
            redirect: false,
          });

          if (signInResult?.error) {
            throw new Error(signInResult.error);
          }

          window.location.replace(buildCleanUrl());
        } catch (error) {
          getLogger().error({ err: error }, 'Assisted buying NextAuth sign-in failed');
        } finally {
          clientSignInInFlight = false;
        }
      })();

      return;
    }

    if (!parseAssistedBuyingTokenParams(params)) {
      return;
    }

    startedRef.current = true;

    const processUrl = buildAssistedBuyingProcessUrl(window.location.origin, params, window.location.pathname);

    window.location.replace(processUrl.toString());
  }, []);

  return null;
}
