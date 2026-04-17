import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixConfig as IEmporixConfig } from '..';

@injectable('EmporixConfig', 'Singleton')
class EmporixConfigServer implements IEmporixConfig {
  baseUrl: string = process.env.NEXT_PUBLIC_EMPORIX_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_PUBLIC_EMPORIX_TENANT || '';
  clientId: string = process.env.NEXT_PUBLIC_EMPORIX_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_PUBLIC_EMPORIX_CLIENT_SECRET || '';
  serverClientId?: string = process.env.NEXT_EMPORIX_CLIENT_ID;
  serverClientSecret?: string = process.env.NEXT_EMPORIX_CLIENT_SECRET;
}

export default EmporixConfigServer;
