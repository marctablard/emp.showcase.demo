import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiInvoker from '@/platform/integrations/emporix/common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '@/platform/integrations/emporix/config';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type {
  BatteryIncludedRuntimeConfig,
  BatteryIncludedConfig as IBatteryIncludedConfig,
} from '../BatteryIncludedConfig';

const BATTERY_INCLUDED_PROVIDER = 'BATTERY_INCLUDED';
const DEFAULT_RUNTIME_CONFIG_TTL_MS = 60_000;

interface EmporixIndexPublicConfigurationResponse {
  applicationId?: unknown;
  indexName?: unknown;
  provider?: unknown;
  searchKey?: unknown;
}

@injectable('BatteryIncludedConfig', 'Singleton')
class BatteryIncludedConfig implements IBatteryIncludedConfig {
  baseUrl: string;

  private readonly runtimeConfigTtlMs: number;

  private cachedRuntimeConfig?: BatteryIncludedRuntimeConfig;

  private cachedRuntimeConfigExpiresAt = 0;

  private runtimeConfigPromise?: Promise<BatteryIncludedRuntimeConfig>;

  constructor(
    @inject('EmporixApiInvoker') private readonly emporixApiInvoker: EmporixApiInvoker,
    @inject('EmporixConfig') private readonly emporixConfig: EmporixConfig,
    @inject('LoggerService') private readonly logger: LoggerService,
  ) {
    this.baseUrl = process.env.NEXT_PUBLIC_BATTERY_INCLUDED_BASE_URL || '';
    this.runtimeConfigTtlMs = DEFAULT_RUNTIME_CONFIG_TTL_MS;
  }

  async getRuntimeConfig(): Promise<BatteryIncludedRuntimeConfig> {
    if (this.cachedRuntimeConfig && this.cachedRuntimeConfigExpiresAt > Date.now()) {
      return this.cachedRuntimeConfig;
    }

    if (this.runtimeConfigPromise) {
      return this.runtimeConfigPromise;
    }

    this.runtimeConfigPromise = this.resolveRuntimeConfig();

    try {
      const runtimeConfig = await this.runtimeConfigPromise;
      this.cachedRuntimeConfig = runtimeConfig;
      this.cachedRuntimeConfigExpiresAt = Date.now() + this.runtimeConfigTtlMs;
      return runtimeConfig;
    } finally {
      this.runtimeConfigPromise = undefined;
    }
  }

  private async resolveRuntimeConfig(): Promise<BatteryIncludedRuntimeConfig> {
    try {
      const response = await this.emporixApiInvoker.authenticatedFetch(
        `/indexing/${this.emporixConfig.tenant}/public/configurations/${BATTERY_INCLUDED_PROVIDER}`,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        'public',
      );

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          {
            provider: BATTERY_INCLUDED_PROVIDER,
            status: response.status,
            statusText: response.statusText,
            errorBody,
            tenant: this.emporixConfig.tenant,
          },
          'Failed to load BatteryIncluded runtime configuration from Emporix indexing',
        );
        throw new Error(
          `Failed to load BatteryIncluded runtime configuration: ${response.status} ${response.statusText}`,
        );
      }

      const payload = (await response.json()) as EmporixIndexPublicConfigurationResponse;
      const apiKey = typeof payload.searchKey === 'string' ? payload.searchKey.trim() : '';
      const collection = typeof payload.indexName === 'string' ? payload.indexName.trim() : '';

      if (!apiKey || !collection) {
        this.logger.error(
          {
            payload,
            provider: BATTERY_INCLUDED_PROVIDER,
            tenant: this.emporixConfig.tenant,
          },
          'Emporix indexing configuration is missing BatteryIncluded search key or index name',
        );
        throw new Error('Emporix indexing configuration is missing BatteryIncluded searchKey or indexName');
      }

      this.logger.info(
        {
          provider: BATTERY_INCLUDED_PROVIDER,
          tenant: this.emporixConfig.tenant,
          collection,
          apiKeyPresent: true,
        },
        'Resolved BatteryIncluded runtime configuration',
      );

      return {
        apiKey,
        collection,
      };
    } catch (error) {
      this.logger.error(
        {
          error: error instanceof Error ? error.message : String(error),
          provider: BATTERY_INCLUDED_PROVIDER,
          tenant: this.emporixConfig.tenant,
        },
        'BatteryIncluded runtime configuration resolution failed',
      );
      throw error;
    }
  }
}

export default BatteryIncludedConfig;
