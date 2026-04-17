import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedConfig as IBatteryIncludedConfig } from '../BatteryIncludedConfig';

@injectable('BatteryIncludedConfig', 'Singleton')
class BatteryIncludedConfig implements IBatteryIncludedConfig {
  baseUrl: string;
  apiKey: string;
  collection: string;

  constructor() {
    this.baseUrl = process.env.NEXT_PUBLIC_BATTERY_INCLUDED_BASE_URL || '';
    this.apiKey = process.env.NEXT_PUBLIC_BATTERY_INCLUDED_API_KEY || '';
    this.collection = process.env.NEXT_PUBLIC_BATTERY_INCLUDED_COLLECTION || '';
  }
}

export default BatteryIncludedConfig;
