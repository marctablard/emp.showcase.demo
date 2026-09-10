import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { BATTERY_INCLUDED_SEGMENT_IDS_FILTER } from '@/platform/services/model/category/batteryincluded-category';
import type BatteryIncludedApiInvoker from '../../common/impl/BatteryIncludedApiInvoker';
import { appendBatteryIncludedVisibility, buildSearchParams } from '../../common/util/common';
import type { BatteryIncludedConfig, BatteryIncludedRuntimeConfig } from '../../config';
import type {
  BatteryIncludedBrowseVariables,
  BatteryIncludedHighlight,
  BatteryIncludedPreset,
  BatteryIncludedProduct,
  BatteryIncludedSearchParams,
  BatteryIncludedSearchResponse,
  BatteryIncludedSuggestParams,
  BatteryIncludedSuggestion,
  BatteryIncludedVisibilityContext,
} from '../../model';
import type {
  BatteryIncludedCategoryTreeBootstrapParams,
  BatteryIncludedShopApi as IBatteryIncludedShopApi,
} from '../BatteryIncludedShopApi';

@injectable('BatteryIncludedShopApi', 'Singleton')
class BatteryIncludedShopApi implements IBatteryIncludedShopApi {
  constructor(
    @inject('BatteryIncludedApiInvoker') private apiClient: BatteryIncludedApiInvoker,
    @inject('BatteryIncludedConfig') private config: BatteryIncludedConfig,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  private async getCollectionRuntimeConfig(): Promise<BatteryIncludedRuntimeConfig> {
    return this.config.getRuntimeConfig();
  }

  /**
   * Browse products with optional search query and filters
   */
  async browse<T>(params: BatteryIncludedSearchParams<T>): Promise<BatteryIncludedSearchResponse<T>> {
    const runtimeConfig = await this.getCollectionRuntimeConfig();
    const queryString = buildSearchParams(params);
    const url = `/api/v1/collections/${runtimeConfig.collection}/documents/browse?${queryString}`;
    this.logger.debug({ url, queryString }, 'BatteryIncluded outgoing browse query');

    const response = await this.apiClient.apiFetch(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      runtimeConfig,
    );

    if (!response.ok) {
      const data = await response.text();
      throw new Error(`Failed to fetch products: ${response.statusText} - ${data}`);
    }

    return await response.json();
  }

  async browseCategoryTreeBootstrap<T>(
    params: BatteryIncludedCategoryTreeBootstrapParams,
  ): Promise<BatteryIncludedSearchResponse<T>> {
    const visibility: BatteryIncludedVisibilityContext = {
      variables: {
        locale: params.locale,
        siteAware: params.siteCode,
        countryAware: params.country,
        ...(params.variables ?? {}),
        ...(params.visibility?.variables ?? {}),
      },
      ...(params.visibility?.filters ? { filters: params.visibility.filters } : {}),
    };

    return this.browse<T>({
      query: '',
      page: 0,
      size: 0,
      variants: 0,
      analyze: 1,
      visibility,
    });
  }

  /**
   * Get product suggestions based on a search query
   */
  async suggest(params: BatteryIncludedSuggestParams): Promise<BatteryIncludedSuggestion<BatteryIncludedProduct>[]> {
    const runtimeConfig = await this.getCollectionRuntimeConfig();
    const { query, segmentIds, variables, visibility } = params;
    const searchParams = new URLSearchParams();
    searchParams.append('q', query);
    searchParams.append('analyze', '1');

    appendBatteryIncludedVisibility(searchParams, visibility ?? variables);

    if (segmentIds?.length) {
      segmentIds.forEach((segmentId) => {
        searchParams.append(`f[${BATTERY_INCLUDED_SEGMENT_IDS_FILTER}][]`, segmentId);
      });
    }

    const url = `/api/v1/collections/${runtimeConfig.collection}/documents/suggest?${searchParams.toString()}`;

    try {
      const response = await this.apiClient.apiFetch(
        url,
        {
          method: 'GET',
          headers: { Accept: 'application/json' },
        },
        runtimeConfig,
      );

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
  async getHighlights(
    variables?: BatteryIncludedBrowseVariables | BatteryIncludedVisibilityContext,
  ): Promise<BatteryIncludedHighlight[]> {
    const runtimeConfig = await this.getCollectionRuntimeConfig();
    const searchParams = new URLSearchParams();
    appendBatteryIncludedVisibility(searchParams, variables);
    const queryString = searchParams.toString();
    const url = queryString
      ? `/api/v1/collections/${runtimeConfig.collection}/documents/highlights?${queryString}`
      : `/api/v1/collections/${runtimeConfig.collection}/documents/highlights`;

    const response = await this.apiClient.apiFetch(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      runtimeConfig,
    );

    const data = await response.json();
    return data.highlights || [];
  }

  /**
   * Get product recommendations based on a product ID
   */
  async getRecommendations(
    id: string,
    variables?: BatteryIncludedBrowseVariables | BatteryIncludedVisibilityContext,
  ): Promise<BatteryIncludedProduct[]> {
    const runtimeConfig = await this.getCollectionRuntimeConfig();
    const params = new URLSearchParams();
    params.append('id', id);
    appendBatteryIncludedVisibility(params, variables);

    const url = `/api/v1/collections/${runtimeConfig.collection}/documents/recommendations?${params.toString()}`;

    const response = await this.apiClient.apiFetch(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      runtimeConfig,
    );

    return await response.json();
  }

  /**
   * Get available presets
   */
  async getPresets(
    variables?: BatteryIncludedBrowseVariables | BatteryIncludedVisibilityContext,
  ): Promise<BatteryIncludedPreset[]> {
    const runtimeConfig = await this.getCollectionRuntimeConfig();
    const searchParams = new URLSearchParams();
    appendBatteryIncludedVisibility(searchParams, variables);
    const queryString = searchParams.toString();
    const url = queryString
      ? `/api/v1/collections/${runtimeConfig.collection}/documents/presets?${queryString}`
      : `/api/v1/collections/${runtimeConfig.collection}/documents/presets`;

    const response = await this.apiClient.apiFetch(
      url,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      runtimeConfig,
    );

    const data = await response.json();
    return data.presets || [];
  }
}

export default BatteryIncludedShopApi;
