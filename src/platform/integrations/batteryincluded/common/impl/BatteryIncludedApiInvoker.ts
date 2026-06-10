import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import {
  type DebugContext,
  buildAndLogCurl,
  getDebugLogger,
  logRequestPayload,
  logResponse,
} from '@/platform/core/utils/debug-utils';
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
    const requestOptions = {
      ...options,
      headers,
    };

    const ctx: DebugContext = { callType: 'external' };
    const prefix = buildAndLogCurl(fullUrl, requestOptions, ctx);
    logRequestPayload(fullUrl, requestOptions, prefix, ctx);

    const responsePromise = fetch(fullUrl, requestOptions);
    responsePromise.catch((err) =>
      getDebugLogger().error(
        { url: fullUrl, error: err instanceof Error ? err.message : String(err) },
        `${prefix} [FETCH ERROR]`,
      ),
    );
    responsePromise.then((response) => logResponse(response, fullUrl, requestOptions, prefix, ctx));

    return responsePromise;
  }
}

export default BatteryIncludedApiInvoker;
