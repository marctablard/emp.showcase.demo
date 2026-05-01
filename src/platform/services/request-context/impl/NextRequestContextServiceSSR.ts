import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { getRequestCurrency, getRequestLanguage } from '@/site/server/RequestPreferences';
import { getRequestSite } from '@/site/server/RequestSite';
import type { RequestContextService } from '../RequestContextService';

@injectable('RequestContextService', 'Singleton')
class NextRequestContextServiceSSR implements RequestContextService {
  async getSite(): Promise<string> {
    return getRequestSite();
  }

  async getCurrency(): Promise<string | undefined> {
    return getRequestCurrency();
  }

  async getLanguage(): Promise<string | undefined> {
    return getRequestLanguage();
  }
}

export default NextRequestContextServiceSSR;
