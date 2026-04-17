import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type { BatteryIncludedConfig } from '../../config';

/**
 * Main client for interacting with Battery Included APIs
 * Handles API key authentication and provides access to API endpoints
 */
@injectable('BatteryIncludedApiInvoker', 'Singleton')
class BatteryIncludedApiInvoker {
  private config: BatteryIncludedConfig;

  constructor(@inject('BatteryIncludedConfig') config: BatteryIncludedConfig) {
    this.config = config;
  }

  /**
   * Create a fetch request with the appropriate authentication headers
   * @param url API endpoint URL
   * @param options Fetch options
   * @returns Promise with the fetch response
   */
  async apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
    // Add authorization header to the request
    const headers = {
      ...options.headers,
      'X-BI-API-KEY': this.config.apiKey,
    };

    // Make the authenticated request
    const fullUrl = `${this.config.baseUrl}${url}`;
    return fetch(fullUrl, {
      ...options,
      headers,
    });
  }
}

export default BatteryIncludedApiInvoker;
