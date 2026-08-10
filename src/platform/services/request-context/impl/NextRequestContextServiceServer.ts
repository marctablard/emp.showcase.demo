import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { DebugCallSource } from '@/platform/core/utils/debug-event-bus';
import { getRequestCurrency, getRequestLanguage } from '@/site/server/RequestPreferences';
import { getRequestSite } from '@/site/server/RequestSite';
import type { RequestContextService } from '../RequestContextService';

@injectable('RequestContextService', 'Singleton')
class NextRequestContextServiceServer implements RequestContextService {
  async getSite(): Promise<string> {
    return getRequestSite();
  }

  async getCurrency(): Promise<string | undefined> {
    return getRequestCurrency();
  }

  async getLanguage(): Promise<string | undefined> {
    return getRequestLanguage();
  }

  /**
   * `'client'`, not `'server'` — this container serves API route handlers, which run on
   * the server but exist because the browser called them. See {@link RequestContextService.getCallSource}.
   */
  getCallSource(): DebugCallSource {
    return 'client';
  }
}

export default NextRequestContextServiceServer;
