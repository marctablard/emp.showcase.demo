'use client';

import { getPathname } from '@/i18n/navigation';
import { fetchCurrentSession } from '@/lib/client/session';
import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';
import { getPublicDefaultSite } from '@/lib/common/public-default-env';
import { getLogger } from '@/lib/logger/use-logger-client';

const CANONICAL_SESSION_FETCH_RETRY_COUNT = 3;
const CANONICAL_SESSION_FETCH_RETRY_DELAY_MS = 250;
const LOGIN_SUCCESS_QUERY_BASE = 'https://placeholder.invalid';

function withLoginSuccessQuery(path: string): string {
  const url = new URL(path, LOGIN_SUCCESS_QUERY_BASE);
  url.searchParams.set('login', 'success');
  return `${url.pathname}${url.search}${url.hash}`;
}

function unknownErrorMessage(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return undefined;
}

async function getCanonicalSiteCode(): Promise<string> {
  const logger = getLogger();
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
        err: unknownErrorMessage(lastError),
        fallbackSiteCode: getPublicDefaultSite(),
      },
      'Post-login canonical session fetch failed after retries, using default site redirect',
    );
    return getPublicDefaultSite();
  }

  return canonicalSiteCode;
}

/**
 * Full-page navigate to a path with `?login=success` on the canonical site.
 * Used after credential login with a callback URL, and after registration billing success.
 */
export async function redirectToLoginSuccess(path: string, locale: string): Promise<void> {
  const postLoginHref = withLoginSuccessQuery(path);
  const canonicalSiteCode = await getCanonicalSiteCode();
  const redirectPath = getPathname({
    href: postLoginHref,
    locale,
    site: canonicalSiteCode,
    forcePrefix: true,
  });
  globalThis.location.href = redirectPath;
}
