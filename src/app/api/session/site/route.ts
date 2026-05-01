import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { SiteService } from '@/platform/services/site/SiteService';

/**
 * PUT /api/session/site — legacy wrapper that delegates to combined `updateContext`.
 *
 * Validates the target site, preserves the current currency when supported (otherwise uses the
 * site default), issues a single upstream PATCH, syncs the site cookie, and returns the
 * canonical Session.
 */
export async function PUT(request: NextRequest) {
  const logger = server.get<LoggerService>('LoggerService');

  try {
    const sessionService = server.get<SessionService>('SessionService');
    const siteService = server.get<SiteService>('SiteService');
    const data = await request.json();

    if (!data.site) {
      return NextResponse.json({ error: 'Site is required' }, { status: 400 });
    }

    logger.info({ targetSite: data.site }, 'PUT /api/session/site — updating session site');

    const newSite = await siteService.getSite(data.site);
    if (!newSite) {
      return NextResponse.json({ error: 'Unknown Site' }, { status: 400 });
    }

    // Preserve current currency if the target site supports it; otherwise use the site default.
    const currentSession = await sessionService.getCurrent();
    const currentCurrency = currentSession?.currency;
    const supportedCurrencyIds = new Set<string>();
    if (newSite.defaultCurrency?.id) {
      supportedCurrencyIds.add(newSite.defaultCurrency.id);
    }
    for (const currency of newSite.currencies ?? []) {
      if (currency.id) {
        supportedCurrencyIds.add(currency.id);
      }
    }
    const shouldPreserveCurrency = Boolean(currentCurrency && supportedCurrencyIds.has(currentCurrency));
    const targetCurrency = shouldPreserveCurrency ? undefined : newSite.defaultCurrency.id;

    const updatedSession = await sessionService.updateContext(
      {
        siteCode: newSite.code,
        ...(targetCurrency ? { currency: targetCurrency } : {}),
      },
      {
        expectedVersion: currentSession?.metadata?.version,
      },
    );

    logger.info(
      {
        site: newSite.code,
        previousCurrency: currentCurrency,
        currency: shouldPreserveCurrency ? currentCurrency : newSite.defaultCurrency.id,
        currencyPreserved: shouldPreserveCurrency,
      },
      'Session site updated successfully',
    );

    const response = NextResponse.json(updatedSession ?? { success: true });
    // Sync the site cookie so edge middleware does not redirect away on the next navigation.
    // TODO: lift `NEXT_SITE` to `@/lib/common/public-default-env` to avoid inline default.
    const siteCookieName = process.env.NEXT_PUBLIC_SITE_COOKIE || 'NEXT_SITE';
    response.cookies.set({
      name: siteCookieName,
      value: newSite.code,
      maxAge: 365 * 24 * 60 * 60,
      httpOnly: false,
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const isVersionConflictError =
      errorMessage.includes('Failed to update own session context: Not Found') &&
      errorMessage.includes('version') &&
      errorMessage.includes('has not been found');

    logger.error(
      {
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined,
        errorType: isVersionConflictError ? 'SESSION_CONTEXT_VERSION_CONFLICT' : 'UNKNOWN',
        path: '/api/session/site',
        method: 'PUT',
      },
      'Error updating session site',
    );
    if (isVersionConflictError) {
      return NextResponse.json(
        {
          error: 'Failed to update session site',
          code: 'SESSION_CONTEXT_VERSION_CONFLICT',
        },
        { status: 500 },
      );
    }
    return NextResponse.json(
      { error: 'Failed to update session site', code: 'SESSION_SITE_UPDATE_FAILED' },
      { status: 500 },
    );
  }
}
