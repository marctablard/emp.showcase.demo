import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedConfig } from '../../config';
import BatteryIncludedApiInvoker from './BatteryIncludedApiInvoker';

@injectable('BatteryIncludedApiInvoker', 'Singleton')
class BatteryIncludedApiInvokerSSR extends BatteryIncludedApiInvoker {
  constructor(@inject('BatteryIncludedConfig') config: BatteryIncludedConfig) {
    super(config, 'ssr');
  }
}

export default BatteryIncludedApiInvokerSSR;
