import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  EmporixMatchPricesByContextRequest,
  EmporixMatchPricesRequest,
  EmporixMatchedPrice,
} from '../../model/price';
import type { EmporixPriceApi as IEmporixPriceApi } from '../EmporixPriceApi';

/**
 * Implementation of the Emporix Price API
 */
@injectable('EmporixPriceApi', 'Singleton')
class EmporixPriceApi implements IEmporixPriceApi {
  readonly config: EmporixConfig;
  protected apiClient: EmporixApiInvoker;

  constructor(
    @inject('EmporixConfig') config: EmporixConfig,
    @inject('EmporixApiInvoker') apiClient: EmporixApiInvoker,
  ) {
    this.config = config;
    this.apiClient = apiClient;
  }

  /**
   * Match prices for specific attributes
   * @param request The price matching request
   * @returns The matched price response
   */
  async matchPrices(request: EmporixMatchPricesRequest): Promise<EmporixMatchedPrice[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/price/${this.config.tenant}/match-prices`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      },
      'public',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to match prices: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  /**
   * Match prices based on session context
   * @param request The price matching by context request
   * @returns The matched price response
   */
  async matchPricesByContext(request: EmporixMatchPricesByContextRequest): Promise<EmporixMatchedPrice[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/price/${this.config.tenant}/match-prices-by-context`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      },
      'session',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to match prices by context: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }
}

export default EmporixPriceApi;
