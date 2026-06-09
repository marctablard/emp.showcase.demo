import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { CURRENCY_COOKIE_NAME } from '@/lib/common/cookie-names';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Session } from '@/platform/services/model/session/session';
import type { SessionService } from '@/platform/services/session/SessionService';

/** GET /api/session — returns the current session. */
export async function GET() {
  try {
    const sessionService = server.get<SessionService>('SessionService');
    const session = await sessionService.getCurrent();
    return NextResponse.json(session);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/session',
        method: 'GET',
      },
      'Error fetching session data',
    );
    return NextResponse.json({ error: 'Failed to fetch session data' }, { status: 500 });
  }
}

type CombinedSessionPatchBody = {
  // Canonical key is `siteCode`; `site` is accepted for backwards compatibility.
  siteCode?: string;
  site?: string;
  currency?: string;
  language?: string;
  country?: string;
  // Optimistic-locking hint; when present the server can skip the pre-PATCH read on the happy path.
  expectedVersion?: number;
};

/**
 * PATCH /api/session.
 *
 * Combined path (preferred): with `expectedVersion` or ≥2 fields, delegates to
 * `SessionService.updateContext` — one upstream PATCH and returns the canonical Session.
 * Legacy path: a single-field body routes through per-field setters and then refetches.
 *
 * If `siteCode`/`site` is in the payload the site cookie is synced so edge middleware does
 * not redirect away on the next navigation.
 */
export async function PATCH(request: NextRequest) {
  const sessionService = server.get<SessionService>('SessionService');
  const logger = server.get<LoggerService>('LoggerService');

  let body: CombinedSessionPatchBody;
  try {
    body = (await request.json()) as CombinedSessionPatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const targetSiteCode = body.siteCode ?? body.site;
  const fields: {
    siteCode?: string;
    currency?: string;
    language?: string;
    country?: string;
  } = {};
  if (typeof targetSiteCode === 'string' && targetSiteCode.length > 0) {
    fields.siteCode = targetSiteCode;
  }
  if (typeof body.currency === 'string' && body.currency.length > 0) {
    fields.currency = body.currency;
  }
  if (typeof body.language === 'string' && body.language.length > 0) {
    fields.language = body.language;
  }
  if (typeof body.country === 'string' && body.country.length > 0) {
    fields.country = body.country;
  }

  const providedFields = Object.keys(fields);
  const hasExpectedVersion = typeof body.expectedVersion === 'number' && body.expectedVersion > 0;
  const useCombinedPath = hasExpectedVersion || providedFields.length > 1;

  try {
    let updatedSession: Session | undefined;

    if (useCombinedPath && providedFields.length > 0) {
      updatedSession = await sessionService.updateContext(fields, {
        expectedVersion: hasExpectedVersion ? (body.expectedVersion as number) : undefined,
      });
    } else {
      // Legacy per-field fallback for callers still sending single-field bodies.
      if (fields.language !== undefined) {
        await sessionService.setLanguage(fields.language);
      }
      if (fields.currency !== undefined) {
        await sessionService.setCurrency(fields.currency);
      }
      if (fields.country !== undefined) {
        await sessionService.setCountry(fields.country);
      }
      if (fields.siteCode !== undefined) {
        await sessionService.setSite(fields.siteCode);
      }
      updatedSession = await sessionService.getCurrent();
    }

    const response = NextResponse.json(updatedSession ?? null);

    if (fields.siteCode !== undefined) {
      // Sync the site cookie so edge middleware does not redirect away on the next navigation.
      // TODO: lift `NEXT_SITE` to `@/lib/common/public-default-env` to avoid inline default.
      const siteCookieName = process.env.NEXT_PUBLIC_SITE_COOKIE || 'NEXT_SITE';
      response.cookies.set({
        name: siteCookieName,
        value: fields.siteCode,
        maxAge: 365 * 24 * 60 * 60,
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
      });
    }

    if (fields.currency !== undefined) {
      // Persist the currency preference so `EmporixTokenManagerServer.resolveSessionParams`
      // can seed the next anonymous session context (e.g. after logout / token expiry)
      // with the shopper's choice. Prefer the canonical post-PATCH value from the
      // combined path; fall back to the requested value for the legacy per-field path.
      const canonicalCurrency = updatedSession?.currency || fields.currency;
      response.cookies.set({
        name: CURRENCY_COOKIE_NAME,
        value: canonicalCurrency,
        maxAge: 365 * 24 * 60 * 60,
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
      });
    }

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
        path: '/api/session',
        method: 'PATCH',
        fields: providedFields,
        combined: useCombinedPath,
      },
      'Error updating session data',
    );

    if (isVersionConflictError) {
      return NextResponse.json(
        { error: 'Failed to update session data', code: 'SESSION_CONTEXT_VERSION_CONFLICT' },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: 'Failed to update session data' }, { status: 500 });
  }
}
