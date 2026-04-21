import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { getRequestSite } from '@/site/server/RequestSite';
import type { RequestContextService } from '../RequestContextService';

@injectable('RequestContextService', 'Singleton')
class NextRequestContextServiceSSR implements RequestContextService {
  async getSite(): Promise<string> {
    return getRequestSite();
  }
}

export default NextRequestContextServiceSSR;
