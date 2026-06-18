import 'server-only';
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
class BatteryIncludedApiInvoker {
  private config: BatteryIncludedConfig;
  private source: NonNullable<DebugContext['source']>;

  constructor(config: BatteryIncludedConfig, source: NonNullable<DebugContext['source']> = 'unknown') {
    this.config = config;
    this.source = source;
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

    const ctx: DebugContext = { callType: 'external', source: this.source };
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
