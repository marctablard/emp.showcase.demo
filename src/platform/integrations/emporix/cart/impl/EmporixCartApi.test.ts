import { Container, inject } from 'inversify';
import { StoredToken } from '@/platform/integrations/types/auth';
import type { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTokenManagerAbstract, TokenStore } from '../../common/impl/EmporixTokenManagerAbstract';
import type { EmporixTokenType } from '../../common/token-types';
import { EmporixConfig } from '../../config';
import {
  EmporixAddCartItemRequest,
  EmporixCart,
  EmporixCreateCartRequest,
  EmporixUpdateCartItemRequest,
} from '../../model';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixCartApi from './EmporixCartApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || '';
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
  serverClientId: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_ID || '';
  serverClientSecret: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_SECRET || '';
}

class TestTokenManager extends EmporixTokenManagerAbstract {
  constructor(@inject('EmporixOAuthApi') oauthApi: EmporixOAuthApi) {
    super(oauthApi);
  }
  protected readTokens(): Promise<TokenStore> {
    throw new Error('Method not implemented.');
  }
  protected writeTokens(tokens: TokenStore): Promise<void> {
    throw new Error('Method not implemented.');
  }
  private tokenStore: Map<EmporixTokenType, StoredToken<any>> = new Map();
  protected async readToken<T extends StoredToken<K>, K>(type: EmporixTokenType): Promise<T | undefined> {
    return this.tokenStore.get(type) as T | undefined;
  }
  protected writeToken<T extends StoredToken<K>, K>(type: EmporixTokenType, token: T | undefined): Promise<void> {
    if (token) {
      this.tokenStore.set(type, token);
    } else {
      this.tokenStore.delete(type);
    }
    return Promise.resolve();
  }
  public clearTokens(): void {
    this.tokenStore.clear();
  }
}

// Sample cart creation request
const sampleCreateCartRequest: EmporixCreateCartRequest = {
  siteCode: 'main',
  currency: 'EUR',
  type: 'shopping',
  channel: {
    name: 'storefront',
    source: 'https://emporix-showcase.com/',
  },
  sessionValidated: true,
};

// Sample cart item request using product c1 (from the product API test)
const sampleAddItemRequest: EmporixAddCartItemRequest = {
  siteCode: 'main',
  itemYrn: 'urn:yaas:saasag:caasproduct:product:showcasetest;1',
  quantity: 1,
  price: {
    priceId: '682c2059e7c3ee6b744ac649',
    effectiveAmount: 9.99,
    originalAmount: 9.99,
    currency: 'EUR',
  },
};

// Sample cart item request using product c1 (from the product API test)
const sampleUpdateItemRequest: EmporixUpdateCartItemRequest = {
  quantity: 4,
  price: {
    priceId: '682c2059e7c3ee6b744ac649',
    effectiveAmount: 9.99,
    originalAmount: 9.99,
    currency: 'EUR',
  },
};

describe('EmporixCartApi', () => {
  let container: Container;
  let cartApi: EmporixCartApi;
  let apiInvoker: EmporixApiInvoker;
  let createdCartId: string;
  let createdItemId: string;

  beforeAll(async () => {
    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<EmporixTokenManager>('EmporixTokenManager').to(TestTokenManager).inSingletonScope();
    container
      .bind<EmporixApiInvoker>('EmporixApiInvoker')
      .toDynamicValue(
        (ctx) =>
          new EmporixApiInvoker(
            ctx.get<EmporixConfig>('EmporixConfig'),
            ctx.get<EmporixTokenManager>('EmporixTokenManager'),
          ),
      )
      .inSingletonScope();
    container.bind<EmporixCartApi>('EmporixCartApi').to(EmporixCartApi);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    cartApi = container.get<EmporixCartApi>('EmporixCartApi');
  });

  afterAll(async () => {
    // Clean up any tokens
    await apiInvoker.clearTokens();
  });

  describe('Cart Operations', () => {
    it('should create a new cart', async () => {
      // Create a cart
      createdCartId = await cartApi.createCart(sampleCreateCartRequest);

      // Verify the cart was created
      expect(createdCartId).toBeDefined();
      expect(typeof createdCartId).toBe('string');
    }, 10000);

    let cart: EmporixCart | undefined | null;
    it('should get a cart by ID', async () => {
      // Get the cart we just created
      cart = await cartApi.getCart(createdCartId);

      // Verify the cart details
      expect(cart).toBeDefined();
      expect(cart?.id).toBe(createdCartId);
      expect(cart?.currency).toBe(sampleCreateCartRequest.currency);
      expect(cart?.siteCode).toBe(sampleCreateCartRequest.siteCode);
      expect(cart?.type).toBe(sampleCreateCartRequest.type);
    }, 10000);

    it('should get a cart by criteria', async () => {
      // Get the cart by site code
      const foundCart = await cartApi.getCartByCriteria(
        sampleCreateCartRequest.siteCode,
        cart?.sessionId, // sessionId
        undefined, // customerId
        sampleCreateCartRequest.type,
      );

      // Verify the cart details
      expect(foundCart).toBeDefined();
      expect(foundCart?.currency).toBe(sampleCreateCartRequest.currency);
      expect(foundCart?.siteCode).toBe(sampleCreateCartRequest.siteCode);
      expect(foundCart?.sessionId).toBe(cart?.sessionId);
    }, 10000);
  });

  describe('Cart Item Operations', () => {
    it('should add an item to the cart', async () => {
      // Add an item to the cart
      createdItemId = await cartApi.addItemToCart(createdCartId, sampleAddItemRequest);

      // Verify the item was added
      expect(createdItemId).toBeDefined();
      expect(typeof createdItemId).toBe('string');
    }, 10000);

    it('should get all items in the cart', async () => {
      // Get all items in the cart
      const items = await cartApi.getCartItems(createdCartId);

      // Verify the items
      expect(items).toBeDefined();
      expect(items.length).toBeGreaterThan(0);

      // Find our added item
      const addedItem = items.find((item) => item.id === createdItemId);
      expect(addedItem).toBeDefined();
      expect(addedItem?.quantity).toBe(sampleAddItemRequest.quantity);
    }, 10000);

    it('should update cart item quantity', async () => {
      // Update the item
      await cartApi.updateCartItemQuantity(createdCartId, createdItemId, sampleUpdateItemRequest);

      // Get the updated item
      const items = await cartApi.getCartItems(createdCartId);
      const updatedItem = items.find((item) => item.id === createdItemId);

      // Verify the quantity was updated
      expect(updatedItem).toBeDefined();
      expect(updatedItem?.quantity).toBe(sampleUpdateItemRequest.quantity);
    }, 10000);

    it('should remove an item from the cart', async () => {
      // Remove the item
      await cartApi.removeCartItem(createdCartId, createdItemId);

      // Get all items
      const items = await cartApi.getCartItems(createdCartId);

      // Verify the item was removed
      const removedItem = items.find((item) => item.id === createdItemId);
      expect(removedItem).toBeUndefined();
    }, 10000);
  });

  describe('Error Handling', () => {
    it('should handle non-existent cart', async () => {
      // Attempt to get a non-existent cart
      const nonExistentCartId = 'non-existent-cart-id';
      const cart = await cartApi.getCart(nonExistentCartId);

      // Verify the cart is null
      expect(cart).toBeNull();
    }, 10000);

    it('should throw error when adding item to non-existent cart', async () => {
      // Attempt to add an item to a non-existent cart
      const nonExistentCartId = 'non-existent-cart-id';

      // Expect the operation to throw an error
      await expect(cartApi.addItemToCart(nonExistentCartId, sampleAddItemRequest)).rejects.toThrow();
    }, 10000);
  });

  describe('Cart Deletion', () => {
    it('should delete a cart', async () => {
      // Delete the cart
      await cartApi.deleteCart(createdCartId);

      // Verify the cart was deleted
      const cart = await cartApi.getCart(createdCartId);
      expect(cart).toBeNull();
    }, 10000);
  });
});
