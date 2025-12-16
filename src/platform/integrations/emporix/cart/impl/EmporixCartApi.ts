import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import {
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
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create cart: ${response.statusText} ${errorDetails}`);
    }

    const createdCart: EmporixCreatedCart = await response.json();

    return createdCart.cartId;
  }

  async getCart(cartId: string, checkSession = true): Promise<EmporixCart | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts/${cartId}`,
      { method: 'GET' },
      checkSession ? 'session' : 'service',
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

  // TODO needs resolution of DCPS-16828
  async getCartByCriteria(
    siteCode: string,
    sessionId?: string,
    customerId?: string,
    type?: string,
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

    const response = await this.apiClient.authenticatedFetch(
      `/cart/${this.config.tenant}/carts?${queryParams.toString()}`,
      { method: 'GET' },
      'session',
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
      { method: 'POST', body: JSON.stringify(body) },
      'session',
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
      { method: 'GET' },
      'session',
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
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to merge carts: ${response.statusText} ${errorDetails}`);
    }
  }
}

export default EmporixCartApi;
