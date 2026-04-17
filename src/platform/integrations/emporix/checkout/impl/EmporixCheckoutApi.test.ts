import { Container } from 'inversify';
import EmporixCartApi from '../../cart/impl/EmporixCartApi';
import { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import EmporixCustomerApi from '../../customer/impl/EmporixCustomerApi';
import {
  EmporixAddCartItemRequest,
  EmporixCartCheckoutRequest,
  EmporixCheckoutAddress,
  EmporixCheckoutCustomer,
  EmporixCheckoutPaymentMethod,
  EmporixCreateCartRequest,
  EmporixSessionContext,
  EmporixShipping,
} from '../../model';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixCheckoutApi from './EmporixCheckoutApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || '';
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
  serverClientId: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_ID || '';
  serverClientSecret: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_SECRET || '';
}

// Using EmporixTestTokenManager from the imported file

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

// Sample checkout request
const createSampleCheckoutRequest = (
  cartId: string,
  isGuest: boolean = true,
  email: string = 'guest@checkout.com',
  customerNumber?: string,
): EmporixCartCheckoutRequest => {
  // Sample customer
  const customer: EmporixCheckoutCustomer = {
    email: email,
    firstName: 'Test',
    lastName: 'User',
    contactPhone: '1234567890',
    guest: isGuest,
  };

  if (customerNumber) {
    customer.id = customerNumber;
  }

  // Sample billing address
  const billingAddress: EmporixCheckoutAddress = {
    contactName: 'Test User',
    type: 'BILLING',
    country: 'DE',
    city: 'Berlin',
    zipCode: '10115',
    street: 'Test Street',
    streetNumber: '123',
  };

  // Sample shipping address
  const shippingAddress: EmporixCheckoutAddress = {
    contactName: 'Test User',
    type: 'SHIPPING',
    country: 'DE',
    city: 'Berlin',
    zipCode: '10115',
    street: 'Test Street',
    streetNumber: '123',
  };

  // Sample payment method
  const paymentMethod: EmporixCheckoutPaymentMethod = {
    provider: 'none',
    method: 'invoice',
  };

  // Sample shipping
  const shipping: EmporixShipping = {
    methodId: 'de-standard',
    zoneId: 'de-region',
    methodName: 'Standard Shipping',
    amount: 4.99,
  };

  return {
    cartId,
    customer,
    addresses: [billingAddress, shippingAddress],
    paymentMethods: [paymentMethod],
    shipping,
  };
};

describe('EmporixCheckoutApi', () => {
  let container: Container;
  let checkoutApi: EmporixCheckoutApi;
  let cartApi: EmporixCartApi;
  let apiInvoker: EmporixApiInvoker;
  let customerApi: EmporixCustomerApi;
  let config: EmporixConfig;
  let createdCartId: string;

  beforeAll(async () => {
    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<EmporixTokenManager>('EmporixTokenManager').to(EmporixTestTokenManager);
    container.bind<EmporixApiInvoker>('EmporixApiInvoker').to(EmporixApiInvoker);
    container.bind<EmporixCartApi>('EmporixCartApi').to(EmporixCartApi);
    container.bind<EmporixCheckoutApi>('EmporixCheckoutApi').to(EmporixCheckoutApi);
    container.bind<EmporixCustomerApi>('EmporixCustomerApi').to(EmporixCustomerApi);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    cartApi = container.get<EmporixCartApi>('EmporixCartApi');
    checkoutApi = container.get<EmporixCheckoutApi>('EmporixCheckoutApi');
    customerApi = container.get<EmporixCustomerApi>('EmporixCustomerApi');
    config = container.get<EmporixConfig>('EmporixConfig');
  });

  afterAll(async () => {
    // Clean up any tokens
    await apiInvoker.clearTokens();
  });

  async function createFreshCustomerCartId(sessionContext?: EmporixSessionContext) {
    const customerProfile = await customerApi.getCustomerProfile();
    const customerId = sessionContext?.customerId ?? customerProfile.id;

    if (!customerId) {
      throw new Error('Customer ID is required to create a fresh customer cart');
    }

    return await cartApi.createCart({
      ...sampleCreateCartRequest,
      customerId,
    });
  }

  async function addItemToCustomerCart(cartId: string, item: EmporixAddCartItemRequest): Promise<string> {
    const response = await apiInvoker.authenticatedFetch(
      `/cart/${config.tenant}/carts/${cartId}/items?siteCode=${item.siteCode}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(item),
      },
      'customer-saas',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to add item to cart: ${response.statusText} ${errorDetails}`);
    }

    const createdItem: { itemId: string } = await response.json();
    return createdItem.itemId;
  }

  describe('Checkout Operations', () => {
    // Create a cart and add items before testing checkout
    beforeEach(async () => {
      // Create a cart
      createdCartId = await cartApi.createCart(sampleCreateCartRequest);
      expect(createdCartId).toBeDefined();

      // Add an item to the cart
      const itemId = await cartApi.addItemToCart(createdCartId, sampleAddItemRequest);
      expect(itemId).toBeDefined();
    }, 15000);

    // Clean up the cart after each test
    afterEach(async () => {
      try {
        // Delete the cart if it exists
        if (createdCartId) {
          await cartApi.deleteCart(createdCartId);
        }
      } catch (error) {
        // fail silently, because it may have succesfully checked out
      }
    }, 10000);

    it('should perform a guest checkout', async () => {
      // Create a checkout request for the cart
      const checkoutRequest = createSampleCheckoutRequest(createdCartId, true);

      // Perform the checkout
      const response = await checkoutApi.guestCheckout(checkoutRequest);

      // Verify the checkout response
      expect(response).toBeDefined();
      expect(response.orderId).toBeDefined();
      expect(typeof response.orderId).toBe('string');
    }, 20000);

    it('should reject checkout with invalid cart ID', async () => {
      // Create a checkout request with an invalid cart ID
      const checkoutRequest = createSampleCheckoutRequest('invalid-cart-id', true);

      // Expect the checkout to fail
      await expect(checkoutApi.guestCheckout(checkoutRequest)).rejects.toThrow();
    }, 10000);

    it('should reject guest checkout with non-guest customer', async () => {
      // Create a checkout request with a non-guest customer
      const checkoutRequest = createSampleCheckoutRequest(createdCartId, false);

      // Expect the checkout to fail
      await expect(checkoutApi.guestCheckout(checkoutRequest)).rejects.toThrow();
    }, 10000);

    it('should reject customer checkout with guest customer', async () => {
      // Create a checkout request with a guest customer
      const checkoutRequest = createSampleCheckoutRequest(createdCartId, true);

      // Expect the checkout to fail
      await expect(checkoutApi.checkout(checkoutRequest)).rejects.toThrow();
    }, 10000);
  });

  // Customer checkout tests with real credentials
  describe('Customer B2B Checkout Operations', () => {
    // Helper function to set up customer token
    const username = 'forrest.gump@alaba.ma';
    async function setupCustomerToken(): Promise<EmporixSessionContext> {
      try {
        await apiInvoker.clearTokens();
        // Login with test customer credentials
        const password = 'Test1234';

        // Use the customer API to login
        return await customerApi.login(username, password);
      } catch (error) {
        console.error('Error setting up customer token:', error);
        throw error;
      }
    }
    let customerCartId: string;

    beforeEach(async () => {
      // Set up a customer token with test user credentials
      const sessionContext = await setupCustomerToken();

      // Create a cart
      customerCartId = await createFreshCustomerCartId(sessionContext);
      expect(customerCartId).toBeDefined();

      // Add an item to the cart
      const itemId = await addItemToCustomerCart(customerCartId, sampleAddItemRequest);
      expect(itemId).toBeDefined();
    }, 15000);

    it('should perform a B2B customer checkout', async () => {
      // Create a checkout request for the cart
      const checkoutRequest = createSampleCheckoutRequest(customerCartId, false, username, '00632699');
      // Perform the checkout
      const response = await checkoutApi.checkout(checkoutRequest);
      // Verify the checkout response
      expect(response).toBeDefined();
      expect(response.orderId).toBeDefined();
      expect(typeof response.orderId).toBe('string');
    }, 20000);

    afterEach(async () => {
      try {
        if (customerCartId) {
          await cartApi.deleteCart(customerCartId);
        }
      } catch (_error) {
        // Checkout can consume/delete the cart before teardown runs.
      }
    }, 15000);
  });

  describe('Customer B2C Checkout Operations', () => {
    // Helper function to set up customer token
    const username = 'jenny.curran@alaba.ma';
    async function setupCustomerToken(): Promise<EmporixSessionContext> {
      try {
        await apiInvoker.clearTokens();
        // Login with test customer credentials
        const password = 'Test1234';

        // Use the customer API to login
        return await customerApi.login(username, password);
      } catch (error) {
        console.error('Error setting up B2C customer token:', error);
        throw error;
      }
    }
    let customerCartId: string;

    beforeEach(async () => {
      // Set up a customer token with test user credentials
      const sessionContext = await setupCustomerToken();

      // Create a cart
      customerCartId = await createFreshCustomerCartId(sessionContext);
      expect(customerCartId).toBeDefined();

      // Add an item to the cart
      const itemId = await addItemToCustomerCart(customerCartId, sampleAddItemRequest);
      expect(itemId).toBeDefined();
    }, 15000);

    it('should perform a B2C customer checkout', async () => {
      // Create a checkout request for the cart
      const checkoutRequest = createSampleCheckoutRequest(customerCartId, false, username, '32667917');

      // Perform the checkout
      const response = await checkoutApi.checkout(checkoutRequest);

      // Expect the checkout to fail
      await expect(checkoutApi.checkout(checkoutRequest)).rejects.toThrow();
      // Verify the checkout response
      expect(response).toBeDefined();
      expect(response.orderId).toBeDefined();
      expect(typeof response.orderId).toBe('string');
    }, 20000);

    afterEach(async () => {
      try {
        if (customerCartId) {
          await cartApi.deleteCart(customerCartId);
        }
      } catch (_error) {
        // Checkout can consume/delete the cart before teardown runs.
      }
    }, 15000);
  });

  describe('Customer Checkout with Approval Required', () => {
    // Helper function to set up customer token
    const username = 'benjamin.blue@alaba.ma';
    async function setupCustomerToken(): Promise<EmporixSessionContext> {
      try {
        await apiInvoker.clearTokens();
        // Login with test customer credentials
        const password = 'Test1234';

        // Use the customer API to login
        return await customerApi.login(username, password);
      } catch (error) {
        console.error('Error setting up customer token for approval flow:', error);
        throw error;
      }
    }
    let customerCartId: string;

    beforeEach(async () => {
      // Set up a customer token with test user credentials
      const sessionContext = await setupCustomerToken();

      // Create a cart
      customerCartId = await createFreshCustomerCartId(sessionContext);
      expect(customerCartId).toBeDefined();

      // Add an item to the cart
      const itemId = await addItemToCustomerCart(customerCartId, sampleAddItemRequest);
      expect(itemId).toBeDefined();
    }, 15000);

    afterEach(async () => {
      try {
        if (customerCartId) {
          await cartApi.deleteCart(customerCartId);
        }
      } catch (_error) {
        // The approval flow can consume/delete the cart during checkout attempts.
      }
    }, 15000);

    it('should fail trying to perform checkout with approval required', async () => {
      // Create a checkout request for the cart
      const checkoutRequest = createSampleCheckoutRequest(customerCartId, false, username, '13360633');
      // Verify the checkout response
      await expect(checkoutApi.checkout(checkoutRequest)).rejects.toThrow();
    }, 20000);
  });
});
