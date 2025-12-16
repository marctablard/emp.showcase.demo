import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import { EmporixSite } from '../../model/site-settings';
import { EmporixSiteSettingsApi as IEmporixSiteSettingsApi } from '../EmporixSiteSettingsApi';

@injectable('EmporixSiteSettingsApi', 'Singleton')
class EmporixSiteSettingsApi implements IEmporixSiteSettingsApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async getSites(
    searchParams: EmporixSearchParams<EmporixSite>,
    includeInactive?: boolean,
  ): Promise<EmporixPaginatedResponse<EmporixSite>> {
    const { query } = buildSearchQuery(searchParams);
    const queryParams = new URLSearchParams(query);
    if (includeInactive) {
      queryParams.append('includeInactiveSites', 'true');
    }

    const url = `/site/${this.config.tenant}/sites?${queryParams.toString()}`;

    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, 'public');

    if (!response.ok) {
      throw new Error(`Failed to get sites: ${response.statusText}`);
    }
    return buildPaginatedResponse(searchParams, response);
  }

  async getSite(siteCode: string): Promise<EmporixSite | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/site/${this.config.tenant}/sites/${siteCode}`,
      { method: 'GET' },
      'public',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Failed to get site: ${response.statusText}`);
    }

    return await response.json();
  }

  async getSiteCodes(includeInactive?: boolean): Promise<string[]> {
    const queryParams = new URLSearchParams();
    if (includeInactive) {
      queryParams.append('includeInactiveSites', 'true');
    }

    const url = `/site/${this.config.tenant}/siteslist${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;

    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, 'public');

    if (!response.ok) {
      throw new Error(`Failed to get site codes: ${response.statusText}`);
    }

    return await response.json();
  }
}

export default EmporixSiteSettingsApi;
