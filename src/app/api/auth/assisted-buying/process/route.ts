import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { buildAssistedBuyingReturnUrl, parseAssistedBuyingTokenParams } from '@/lib/common/assisted-buying';
import {
  armAssistedBuyingNextAuthSignIn,
  completeAssistedBuyingSignIn,
} from '@/lib/server/complete-assisted-buying-sign-in';
import type { EmporixTokenManager } from '@/platform/integrations/emporix/common/EmporixTokenManager';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import server from '@/platform/server';
import type { AuthService } from '@/platform/services/auth/AuthService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * GET /api/auth/assisted-buying/process
 *
 * Stores Emporix assisted-buying tokens and creates the NextAuth session server-side.
 * Triggered by middleware or a client redirect when Management Dashboard opens the storefront.
 */
export async function GET(request: NextRequest) {
  const logger = server.get<LoggerService>('LoggerService');
  const tokenManager = server.get<EmporixTokenManager>('EmporixTokenManager');
  const config = server.get<EmporixConfig>('EmporixConfig');
  const { searchParams } = request.nextUrl;
  const returnPath = searchParams.get('returnPath') || '/';
  const fallbackRedirect = () => NextResponse.redirect(new URL(returnPath, request.url));

  const tokens = parseAssistedBuyingTokenParams(searchParams);
  if (!tokens) {
    logger.warn(
      { path: '/api/auth/assisted-buying/process', returnPath },
      'Assisted buying process called without valid token query params',
    );
    return fallbackRedirect();
  }

  try {
    const authService = server.get<AuthService>('AuthService');
    await authService.loginWithAssistedBuying(tokens);

    const signInResult = await completeAssistedBuyingSignIn();
    tokenManager.clearAssistedBuyingCustomerTokenCache(config.tenant);

    const requireClientSignIn = !signInResult.success;
    if (requireClientSignIn) {
      await armAssistedBuyingNextAuthSignIn();
    }

    const redirectUrl = buildAssistedBuyingReturnUrl(request.url, returnPath, searchParams, {
      requireClientSignIn,
    });

    if (!signInResult.success) {
      logger.error(
        { error: signInResult.error, path: '/api/auth/assisted-buying/process', returnPath },
        'Assisted buying Emporix login succeeded but NextAuth sign-in failed',
      );
    } else {
      logger.info({ path: '/api/auth/assisted-buying/process', returnPath }, 'Assisted buying login completed');
    }

    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    tokenManager.clearAssistedBuyingCustomerTokenCache(config.tenant);
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/auth/assisted-buying/process',
        method: 'GET',
        returnPath,
      },
      'Assisted buying process error',
    );

    return fallbackRedirect();
  }
}
