import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type BatteryIncludedApiInvoker from '../../common/impl/BatteryIncludedApiInvoker';
import { buildSearchParams } from '../../common/util/common';
import type { BatteryIncludedConfig } from '../../config';
import type {
  BatteryIncludedHighlight,
  BatteryIncludedPreset,
  BatteryIncludedProduct,
  BatteryIncludedSearchParams,
  BatteryIncludedSearchResponse,
  BatteryIncludedSuggestion,
} from '../../model';
import type { BatteryIncludedShopApi as IBatteryIncludedShopApi } from '../BatteryIncludedShopApi';

@injectable('BatteryIncludedShopApi', 'Singleton')
class BatteryIncludedShopApi implements IBatteryIncludedShopApi {
  constructor(
    @inject('BatteryIncludedApiInvoker') private apiClient: BatteryIncludedApiInvoker,
    @inject('BatteryIncludedConfig') private config: BatteryIncludedConfig,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  /**
   * Browse products with optional search query and filters
   */
  async browse<T>(params: BatteryIncludedSearchParams<T>): Promise<BatteryIncludedSearchResponse<T>> {
    const queryString = buildSearchParams(params);
    const url = `/api/v1/collections/${this.config.collection}/documents/browse?${queryString}`;

    const response = await this.apiClient.apiFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      const data = await response.text();
      throw new Error(`Failed to fetch products: ${response.statusText} - ${data}`);
    }

    return await response.json();
  }

  /**
   * Get product suggestions based on a search query
   */
  async suggest(query: string, locale?: string, segmentIds?: string): Promise<BatteryIncludedSuggestion[]> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (locale) {
      params.append('v[locale]', locale);
    }

    if (segmentIds) {
      params.append('f[segmentIds][]', segmentIds);
    }

    const url = `/api/v1/collections/${this.config.collection}/documents/suggest?${params.toString()}`;

    try {
      const response = await this.apiClient.apiFetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error({ statusText: response.statusText, errorText }, 'ShopApi suggest API error');
        return [];
      }

      return await response.json();
    } catch (error) {
      this.logger.error(
        { error: error instanceof Error ? error.message : String(error) },
        'ShopApi exception in suggest API call',
      );
      return [];
    }
  }

  /**
   * Get highlighted products
   */
  async getHighlights(): Promise<BatteryIncludedHighlight[]> {
    const url = `/api/v1/collections/${this.config.collection}/documents/highlights`;

    const response = await this.apiClient.apiFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = await response.json();
    return data.highlights || [];
  }

  /**
   * Get product recommendations based on a product ID
   */
  async getRecommendations(id: string): Promise<BatteryIncludedProduct[]> {
    const params = new URLSearchParams();
    params.append('id', id);

    const url = `/api/v1/collections/${this.config.collection}/documents/recommendations?${params.toString()}`;

    const response = await this.apiClient.apiFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    return await response.json();
  }

  /**
   * Get available presets
   */
  async getPresets(): Promise<BatteryIncludedPreset[]> {
    const url = `/api/v1/collections/${this.config.collection}/documents/presets`;

    const response = await this.apiClient.apiFetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const data = await response.json();
    return data.presets || [];
  }
}

export default BatteryIncludedShopApi;
