import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type {
  EmporixAddCartItemRequest,
  EmporixCart,
  EmporixCartItem,
  EmporixCreateCartRequest,
  EmporixCreatedCart,
  EmporixCreatedCartItem,
  EmporixPaginatedResponse,
  EmporixSearchParams,
  EmporixUpdateCartItemRequest,
} from '../../model';
import type { EmporixCartApi as IEmporixCartApi } from '../EmporixCartApi';

const createCartMetrics = (route: string) => createFetchMetricsParams('cart', route);

// Ask Emporix to return all locales for localized fields (e.g. product.localizedName
// on cart lines) so the mapper can expose the full map and the UI can resolve
// the current UI locale per render. Without this, Emporix defaults to the
// session language and flattens localized values into a single string.
const ACCEPT_LANGUAGE_ALL: Record<string, string> = { 'Accept-Language': '*' };

@injectable('EmporixCartApi', 'Singleton')
class EmporixCartApi implements IEmporixCartApi {
  protected apiClient: EmporixApiClient;
  protected config: EmporixConfig;

  constructor(
    @inject('EmporixApiInvoker') apiClient: EmporixApiClient,
    @inject('EmporixConfig') config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async createCart(createCartRequest: EmporixCreateCartRequest): Promise<string> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(createCartRequest),
      },
      // differentiate between customer and anonymous
      createCartRequest.customerId ? 'customer-saas' : 'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts'),
    );

    if (!response.ok) {
      const errorDetails = await response.json();
      throw new Error(`Failed to create cart: ${response.statusText}`, errorDetails);
    }

    const createdCart: EmporixCreatedCart = await response.json();

    return createdCart.cartId;
  }

  async getCart(cartId: string, checkSession = true): Promise<EmporixCart | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}`,
      { method: 'GET', headers: { ...ACCEPT_LANGUAGE_ALL } },
      checkSession ? 'session' : 'service',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorDetails = await response.text();
      throw new Error(`Failed to get cart: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async getCartByCriteria(
    siteCode: string,
    sessionId?: string,
    customerId?: string,
    type?: string,
    create?: boolean,
  ): Promise<EmporixCart | null> {
    const queryParams = new URLSearchParams();
    queryParams.append('siteCode', siteCode);

    if (sessionId) {
      queryParams.append('sessionId', sessionId);
    }

    if (customerId) {
      queryParams.append('customerId', customerId);
    }

    if (type) {
      queryParams.append('type', type);
    }

    if (create) {
      queryParams.append('create', 'true');
    }

    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts?${queryParams.toString()}`,
      { method: 'GET', headers: { ...ACCEPT_LANGUAGE_ALL } },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts'),
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorDetails = await response.text();
      throw new Error(`Failed to get cart by criteria: ${response.statusText} ${errorDetails}`);
    }
    return await response.json();
  }

  async searchCarts(searchParams: EmporixSearchParams<EmporixCart>): Promise<EmporixPaginatedResponse<EmporixCart>> {
    const { query, body } = buildSearchQuery(searchParams);
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/search?${query}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...ACCEPT_LANGUAGE_ALL,
        },
        body: JSON.stringify(body),
      },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/search'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to search carts: ${response.statusText} ${errorDetails}`);
    }
    return await response.json();
  }

  async addItemToCart(cartId: string, item: EmporixAddCartItemRequest): Promise<string> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}/items?siteCode=${item.siteCode}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(item),
      },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}/items'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to add item to cart: ${response.statusText} ${errorDetails}`);
    }

    const createdItem: EmporixCreatedCartItem = await response.json();
    return createdItem.itemId;
  }

  async getCartItems(cartId: string): Promise<EmporixCartItem[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}/items`,
      { method: 'GET', headers: { ...ACCEPT_LANGUAGE_ALL } },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}/items'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get cart items: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async updateCartItemQuantity(
    cartId: string,
    itemId: string,
    updateRequest: EmporixUpdateCartItemRequest,
  ): Promise<void> {
    const queryParams = new URLSearchParams();
    queryParams.append('partial', 'true');

    const url = `/cart/${this.config.tenant}/carts/${cartId}/items/${itemId}${
      queryParams.toString() ? `?${queryParams.toString()}` : ''
    }`;

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(updateRequest),
      },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}/items/{itemId}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update cart item: ${response.statusText} ${errorDetails}`);
    }
  }

  async removeCartItem(cartId: string, itemId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}/items/${itemId}`,
      { method: 'DELETE' },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}/items/{itemId}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to remove cart item: ${response.statusText} ${errorDetails}`);
    }
  }

  async deleteCart(cartId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}`,
      { method: 'DELETE' },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete cart: ${response.statusText} ${errorDetails}`);
    }
  }

  async updateCart(cartId: string, cart: Partial<EmporixCart>): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(cart),
      },
      'service',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update cart: ${response.statusText} ${errorDetails}`);
    }
  }

  async changeCurrency(cartId: string, currency: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}/changeCurrency`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ currency }),
      },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}/changeCurrency'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to change cart currency: ${response.statusText} ${errorDetails}`);
    }
  }

  async changeSite(cartId: string, siteCode: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}/changeSite`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ siteCode }),
      },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}/changeSite'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to change cart site: ${response.statusText} ${errorDetails}`);
    }
  }

  async refreshCart(cartId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}/refresh`,
      {
        method: 'PUT',
        headers: {
          Accept: 'application/json',
        },
      },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}/refresh'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to refresh cart: ${response.statusText} ${errorDetails}`);
    }
  }

  async mergeCarts(sourceCartId: string, targetCartId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${targetCartId}/merge`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ carts: [sourceCartId] }),
      },
      'session',
      undefined,
      createCartMetrics('/cart/{tenant}/carts/{cartId}/merge'),
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to merge carts: ${response.statusText} ${errorDetails}`);
    }
  }
}

export default EmporixCartApi;
