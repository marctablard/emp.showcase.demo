import { cache } from 'react';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { Session } from '@/platform/services/model/session';
import type { SessionService } from '@/platform/services/session';
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
