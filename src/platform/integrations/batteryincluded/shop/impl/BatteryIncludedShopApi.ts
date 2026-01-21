import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type BatteryIncludedApiInvoker from '../../common/impl/BatteryIncludedApiInvoker';
import { buildSearchParams } from '../../common/util/common';
import type { BatteryIncludedConfig } from '../../config';
import {
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
  async suggest(query: string, locale?: string): Promise<BatteryIncludedSuggestion[]> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (locale) {
      params.append('v[locale]', locale);
    }

    const url = `/api/v1/collections/${this.config.collection}/documents/suggest?${params.toString()}`;
    const fullUrl = `${this.config.baseUrl}${url}`;
    console.log(`[ShopApi] Calling suggest endpoint: ${fullUrl}`);

    try {
      const response = await this.apiClient.apiFetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[ShopApi] Suggest API error: ${response.statusText}`, errorText);
        return [];
      }

      // Read response body once (can only be read once)
      const text = await response.text();

      // Check if response has content
      if (!text || text.trim().length === 0) {
        console.warn('[ShopApi] Empty response body from suggest API');
        return [];
      }

      // Check content-type
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const fullUrl = `${this.config.baseUrl}${url}`;
        console.error(
          `[ShopApi] Unexpected content-type in suggest response: ${contentType}`,
          `\nURL: ${fullUrl}`,
          `\nStatus: ${response.status} ${response.statusText}`,
          `\nResponse preview: ${text.substring(0, 500)}`,
        );
        return [];
      }

      // Parse JSON
      try {
        return JSON.parse(text);
      } catch (parseError) {
        console.error('[ShopApi] Failed to parse JSON from suggest response:', parseError, 'Response text:', text);
        return [];
      }
    } catch (error) {
      console.error('[ShopApi] Exception in suggest API call:', error);
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
