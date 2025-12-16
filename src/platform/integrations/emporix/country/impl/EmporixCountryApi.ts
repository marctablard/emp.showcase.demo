import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import { EmporixCountry, EmporixRegion } from '../../model/country';
import { EmporixCountryApi as IEmporixCountryApi } from '../EmporixCountryApi';

@injectable('EmporixCountryApi', 'Singleton')
class EmporixCountryApi implements IEmporixCountryApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async getCountries(active?: boolean): Promise<EmporixCountry[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/country/${this.config.tenant}/countries${active ? `?active=${active}` : ''}`,
      {
        method: 'GET',
        headers: {
          'X-Version': 'v2',
        },
      },
      'public',
    );

    if (!response.ok) {
      throw new Error(`Failed to get countries: ${response.statusText}`);
    }

    return await response.json();
  }

  async getCountry(countryCode: string): Promise<EmporixCountry | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/country/${this.config.tenant}/countries/${countryCode}`,
      {
        method: 'GET',
        headers: {
          'X-Version': 'v2',
        },
      },
      'public',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get country: ${response.statusText}`);
      }
    }

    return await response.json();
  }

  async getRegions(): Promise<EmporixRegion[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/country/${this.config.tenant}/regions`,
      {
        method: 'GET',
        headers: {
          'X-Version': 'v2',
        },
      },
      'public',
    );

    if (!response.ok) {
      throw new Error(`Failed to get regions: ${response.statusText}`);
    }

    return await response.json();
  }

  async getRegion(regionCode: string): Promise<EmporixRegion | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/country/${this.config.tenant}/regions/${regionCode}`,
      {
        method: 'GET',
        headers: {
          'X-Version': 'v2',
        },
      },
      'public',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      } else {
        throw new Error(`Failed to get region: ${response.statusText}`);
      }
    }

    return await response.json();
  }
}

export default EmporixCountryApi;
