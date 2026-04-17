import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixCartApi from '../../cart/impl/EmporixCartApi';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  EmporixCartCheckoutRequest,
  EmporixCheckoutResponse,
  EmporixQuoteCheckoutRequest,
} from '../../model/checkout';
import type { EmporixCheckoutApi as IEmporixCheckoutApi } from '../EmporixCheckoutApi';

@injectable('EmporixCheckoutApi', 'Singleton')
class EmporixCheckoutApi implements IEmporixCheckoutApi {
  protected apiClient: EmporixApiClient;
  protected config: EmporixConfig;
  protected cartApi: EmporixCartApi;

  constructor(
    @inject('EmporixApiInvoker') apiClient: EmporixApiClient,
    @inject('EmporixConfig') config: EmporixConfig,
    @inject('EmporixCartApi') cartApi: EmporixCartApi,
  ) {
    this.apiClient = apiClient;
    this.config = config;
    this.cartApi = cartApi;
  }

  async checkout(request: EmporixCartCheckoutRequest): Promise<EmporixCheckoutResponse> {
    if (request.customer.guest || !request.customer.id) {
      throw new Error('Customer checkout requires logged-in customer');
    }
    const response = await this.apiClient.authenticatedFetch(
      `/checkout/${this.config.tenant}/checkouts/order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      },
      'customer-saas', // Customer checkout requires customer authentication
    );

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(`Failed to checkout: ${response.statusText} ${errorDetails.message}`);
    }

    return await response.json();
  }

  async guestCheckout(request: EmporixCartCheckoutRequest): Promise<EmporixCheckoutResponse> {
    if (!request.customer.guest) {
      throw new Error('Guest checkout requires guest customer');
    }
    const response = await this.apiClient.authenticatedFetch(
      `/checkout/${this.config.tenant}/checkouts/order`,
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
      throw new Error(`Failed to guest checkout: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async checkoutFromQuote(request: EmporixQuoteCheckoutRequest): Promise<EmporixCheckoutResponse> {
    const response = await this.apiClient.authenticatedFetch(
      `/checkout/${this.config.tenant}/checkouts/order`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(request),
      },
      'customer-saas', // Quote checkout requires customer authentication
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to checkout from quote: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }
}

export default EmporixCheckoutApi;
