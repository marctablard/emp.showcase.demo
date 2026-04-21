import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { SiteService } from '@/platform/services/site/SiteService';

/**
 * PUT /api/session/site
 * Update session site
 */
export async function PUT(request: NextRequest) {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const siteService = server.get<SiteService>('SiteService');
    const logger = server.get<LoggerService>('LoggerService');
    const data = await request.json();

    if (!data.site) {
      return NextResponse.json({ error: 'Site is required' }, { status: 400 });
    }

    logger.info({ targetSite: data.site }, 'PUT /api/session/site — updating session site');

    const newSite = await siteService.getSite(data.site);
    if (!newSite) {
      return NextResponse.json({ error: 'Unknown Site' }, { status: 400 });
    }

    // Preserve the user's current currency if the target site supports it; only
    // fall back to the target site's default when the current currency is not
    // available on the new site. Passing `undefined` keeps the currency as-is
    // in the session context.
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

    await sessionService.setSite(newSite.code, targetCurrency);
    logger.info(
      {
        site: newSite.code,
        previousCurrency: currentCurrency,
        currency: shouldPreserveCurrency ? currentCurrency : newSite.defaultCurrency.id,
        currencyPreserved: shouldPreserveCurrency,
      },
      'Session site updated successfully',
    );

    const response = NextResponse.json({ success: true });
    // Keep the site cookie in sync with the user's selected site so the edge middleware
    // (which honours cookieOverridesDefault) does not redirect back to the previously
    // selected non-default site on the next navigation to `/`.
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
    const logger = server.get<LoggerService>('LoggerService');
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
