import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Session } from '@/platform/services/model/session';
import type { SessionService } from '@/platform/services/session';
import type { SiteService } from '@/platform/services/site/SiteService';
import ssr from '@/platform/ssr';

const getSessionService = () => ssr.get<SessionService>('SessionService');
const getLogger = () => ssr.get<LoggerService>('LoggerService');

const _getSession = cache(async (): Promise<Session | null | undefined> => {
  try {
    const session = await getSessionService().getCurrent();
    return session || null;
  } catch (error) {
    getLogger().error({ error: error instanceof Error ? error.message : String(error) }, 'SSR getSession failed');
    return undefined;
  }
});

/**
 * Align the Emporix session's `siteCode` with the URL-derived site before hydration.
 *
 * Emporix server-side sessions are keyed by `sessionId`, not by our `emp-site` cookie,
 * so a deep-link that changes the URL site (e.g. user was on `/main` and follows an
 * external link to `/us-branch/...`) leaves the server session pointing at the old
 * site until the client explicitly PUTs `/api/session/site`. That mismatch causes the
 * layout to seed `StoreProvider` with `siteStore.site = <URL-site>` but
 * `sessionStore.session.siteCode = <old-site>`, forcing `SiteSessionAligner` to run
 * the orchestrator on every deep-link and briefly tearing down the correct site state.
 *
 * This helper closes that gap at SSR: when `currentSession.siteCode !== urlSiteCode`
 * (and the target site is valid) it calls `SessionService.setSite(...)` with the
 * target site's default currency and re-fetches the session so it can be seeded into
 * the stores already aligned. Never throws — on failure, returns the original session
 * and lets the client-side `SiteSessionAligner` fallback handle reconciliation.
 */
async function _alignSessionSite(currentSession: Session, urlSiteCode: string): Promise<Session | null | undefined> {
  if (!currentSession.siteCode || currentSession.siteCode === urlSiteCode) {
    return currentSession;
  }

  const sessionService = getSessionService();
  const logger = getLogger();
  try {
    const siteService = ssr.get<SiteService>('SiteService');
    const targetSite = await siteService.getSite(urlSiteCode);
    if (!targetSite) {
      logger.warn(
        { urlSiteCode, sessionSite: currentSession.siteCode },
        'SSR alignSessionSite skipped — target site not found',
      );
      return currentSession;
    }

    const defaultCurrency = targetSite.defaultCurrency?.id;
    logger.info(
      {
        event: 'ssr_session_site_align',
        fromSite: currentSession.siteCode,
        toSite: urlSiteCode,
        defaultCurrency,
      },
      'SSR aligning session siteCode with URL',
    );
    await sessionService.setSite(urlSiteCode, defaultCurrency);
    const refreshed = await sessionService.getCurrent();
    return refreshed || currentSession;
  } catch (error) {
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        urlSiteCode,
        sessionSite: currentSession.siteCode,
      },
      'SSR alignSessionSite failed — returning stale session; client aligner will recover',
    );
    return currentSession;
  }
}

/**
 * Fetches the current session and aligns it with the URL-derived `siteCode` when the
 * two disagree (see `_alignSessionSite` for rationale). Returns the possibly-updated
 * session. Cached per-request (same request → same value).
 */
const _getSessionForSite = cache(async (urlSiteCode: string): Promise<Session | null | undefined> => {
  const session = await _getSession();
  if (!session) {
    return session;
  }
  return _alignSessionSite(session, urlSiteCode);
});

const _setSessionLanguage = cache(async (language: string): Promise<void> => {
  try {
    await getSessionService().setLanguage(language);
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), language },
      'SSR setSessionLanguage failed',
    );
    return;
  }
});

const _setSessionSite = cache(async (site: string): Promise<void> => {
  try {
    await getSessionService().setSite(site);
  } catch (error) {
    getLogger().error(
      { error: error instanceof Error ? error.message : String(error), site },
      'SSR setSessionSite failed',
    );
    return;
  }
});

export function setSessionLanguage(language: string): Promise<void> {
  return _setSessionLanguage(language);
}

export function setSessionSite(site: string): Promise<void> {
  return _setSessionSite(site);
}

export function getSession(): Promise<Session | null | undefined> {
  return _getSession();
}

/**
 * Prefer this over `getSession()` from layouts/pages that know the URL-derived
 * `siteCode` (e.g. `app/[site]/[locale]/layout.tsx`). Returns the session with
 * `siteCode` forced into alignment with the URL when they disagree — see
 * `_alignSessionSite`.
 */
export function getSessionForSite(urlSiteCode: string): Promise<Session | null | undefined> {
  return _getSessionForSite(urlSiteCode);
}
