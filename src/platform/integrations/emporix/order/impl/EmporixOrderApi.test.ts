import { Container } from 'inversify';
import EmporixCartApi from '../../cart/impl/EmporixCartApi';
import EmporixCheckoutApi from '../../checkout/impl/EmporixCheckoutApi';
import { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import EmporixCustomerApi from '../../customer/impl/EmporixCustomerApi';
import { EmporixAddCartItemRequest, EmporixCreateCartRequest } from '../../model';
import {
  EmporixCartCheckoutRequest,
  EmporixCheckoutAddress,
  EmporixCheckoutCustomer,
  EmporixCheckoutPaymentMethod,
  EmporixShipping,
} from '../../model/checkout';
import { EmporixUpdateOrderRequest } from '../../model/order';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixOrderApi from './EmporixOrderApi';

// Using EmporixTestTokenManager from the imported file
const tenant = process.env.NEXT_EMPORIX_TEST_TENANT || '';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = tenant;
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
  serverClientId: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_ID || '';
  serverClientSecret: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_SECRET || '';
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

// Sample cart item request
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

// Sample order update request
const sampleUpdateOrderRequest: EmporixUpdateOrderRequest = {
  status: 'CONFIRMED',
  customerNote: 'Updated order note',
};

// Helper function to create a checkout request
const createCheckoutRequest = (
  cartId: string,
  isGuest: boolean = true,
  email: string = 'guest@example.com',
  customerNumber?: string,
): EmporixCartCheckoutRequest => {
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

  const billingAddress: EmporixCheckoutAddress = {
    contactName: 'Test User',
    type: 'BILLING',
    country: 'DE',
    city: 'Berlin',
    zipCode: '10115',
    street: 'Test Street',
    streetNumber: '123',
  };

  const shippingAddress: EmporixCheckoutAddress = {
    contactName: 'Test User',
    type: 'SHIPPING',
    country: 'DE',
    city: 'Berlin',
    zipCode: '10115',
    street: 'Test Street',
    streetNumber: '123',
  };

  const paymentMethod: EmporixCheckoutPaymentMethod = {
    provider: 'none',
    method: 'invoice',
  };

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

/**
 * Helper: create a cart, add an item, perform guest checkout, return orderId.
 * Uses the checkout API which is proven to work (see EmporixCheckoutApi.test.ts).
 */
async function createOrderViaCheckout(
  cartApi: EmporixCartApi,
  checkoutApi: EmporixCheckoutApi,
  email: string = 'guest@example.com',
): Promise<string> {
  const cartId = await cartApi.createCart(sampleCreateCartRequest);
  await cartApi.addItemToCart(cartId, sampleAddItemRequest);
  const checkoutRequest = createCheckoutRequest(cartId, true, email);
  const checkoutResponse = await checkoutApi.guestCheckout(checkoutRequest);
  return checkoutResponse.orderId;
}

describe('EmporixOrderApi', () => {
  let container: Container;
  let orderApi: EmporixOrderApi;
  let cartApi: EmporixCartApi;
  let customerApi: EmporixCustomerApi;
  let checkoutApi: EmporixCheckoutApi;
  let apiInvoker: EmporixApiInvoker;

  beforeAll(async () => {
    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<EmporixTokenManager>('EmporixTokenManager').to(EmporixTestTokenManager).inSingletonScope();
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
    container.bind<EmporixCustomerApi>('EmporixCustomerApi').to(EmporixCustomerApi);
    container.bind<EmporixCheckoutApi>('EmporixCheckoutApi').to(EmporixCheckoutApi);
    container.bind<EmporixOrderApi>('EmporixOrderApi').to(EmporixOrderApi);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    cartApi = container.get<EmporixCartApi>('EmporixCartApi');
    customerApi = container.get<EmporixCustomerApi>('EmporixCustomerApi');
    checkoutApi = container.get<EmporixCheckoutApi>('EmporixCheckoutApi');
    orderApi = container.get<EmporixOrderApi>('EmporixOrderApi');
  });

  afterAll(async () => {
    // Clean up any tokens
    await apiInvoker.clearTokens();
  });

  describe('Order Operations', () => {
    let createdOrderId: string;

    // Use checkout flow to create an order (proven to work)
    beforeAll(async () => {
      createdOrderId = await createOrderViaCheckout(cartApi, checkoutApi);
      expect(createdOrderId).toBeDefined();
    }, 30000);

    // Clean up after all tests
    afterAll(async () => {
      try {
        if (createdOrderId) {
          await orderApi.deleteOrder(createdOrderId);
        }
      } catch {
        // Order may already be deleted by the delete test
      }
    }, 10000);

    it('should get an order by ID', async () => {
      const order = await orderApi.getOrder(createdOrderId);

      expect(order).toBeDefined();
      expect(order?.id).toBe(createdOrderId);
    }, 10000);

    it('should get orders with filtering', async () => {
      const orders = await orderApi.getOrders(10, 0);

      expect(orders).toBeDefined();
      expect(Array.isArray(orders)).toBe(true);

      const createdOrder = orders.find((order) => order.id === createdOrderId);
      expect(createdOrder).toBeDefined();
    }, 10000);

    it('should update an order', async () => {
      await orderApi.updateOrder(createdOrderId, sampleUpdateOrderRequest);

      const updatedOrder = await orderApi.getOrder(createdOrderId);

      expect(updatedOrder).toBeDefined();
      expect(updatedOrder?.status).toBe(sampleUpdateOrderRequest.status);
    }, 10000);

    it('should get order status transitions', async () => {
      const transitions = await orderApi.getOrderStatusTransitions(createdOrderId);

      expect(transitions).toBeDefined();
      expect(Array.isArray(transitions)).toBe(true);
    }, 10000);

    it('should delete an order', async () => {
      await orderApi.deleteOrder(createdOrderId);

      const deletedOrder = await orderApi.getOrder(createdOrderId);
      expect(deletedOrder).toBeNull();

      createdOrderId = '';
    }, 10000);
  });

  describe('Customer Order Operations', () => {
    const username = 'forrest.gump@alaba.ma';
    const password = 'Test1234';
    const customerId = '00632699';
    let customerOrderId: string;

    // Helper: get or create a customer cart via customer-saas auth
    async function getOrCreateCustomerCartId(): Promise<string> {
      const queryParams = new URLSearchParams({
        siteCode: sampleCreateCartRequest.siteCode,
        create: 'true',
        customerId,
        type: 'shopping',
      });

      const response = await apiInvoker.authenticatedFetch(
        `/cart/${tenant}/carts?${queryParams.toString()}`,
        { method: 'GET', headers: { Accept: 'application/json' } },
        'customer-saas',
      );

      if (!response.ok) {
        const errorDetails = await response.text();
        throw new Error(`Failed to get or create cart: ${response.statusText} ${errorDetails}`);
      }

      const cart = (await response.json()) as { id?: string; cartId?: string };
      const cartId = cart.id ?? cart.cartId;
      if (!cartId) {
        throw new Error('Cart ID is missing in get/create response');
      }
      return cartId;
    }

    // Helper: add item to customer cart via customer-saas auth
    async function addItemToCustomerCart(cartId: string): Promise<string> {
      const response = await apiInvoker.authenticatedFetch(
        `/cart/${tenant}/carts/${cartId}/items?siteCode=${sampleAddItemRequest.siteCode}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify(sampleAddItemRequest),
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

    // Login as customer before all tests
    beforeAll(async () => {
      await apiInvoker.clearTokens();
      await customerApi.login(username, password);

      // Create a customer-owned order via the checkout flow
      const customerCartId = await getOrCreateCustomerCartId();
      await addItemToCustomerCart(customerCartId);
      const checkoutRequest = createCheckoutRequest(customerCartId, false, username, customerId);
      const checkoutResponse = await checkoutApi.checkout(checkoutRequest);
      customerOrderId = checkoutResponse.orderId;
      expect(customerOrderId).toBeDefined();
    }, 30000);

    afterAll(async () => {
      try {
        await customerApi.logout();
      } catch {
        // Ignore logout errors
      }
    }, 10000);

    it('should get a customer order by ID', async () => {
      const order = await orderApi.getCustomerOrder(customerOrderId);

      expect(order).not.toBeNull();
      expect(order).toBeDefined();
      expect(order?.id).toBe(customerOrderId);
    }, 10000);

    it('should get customer orders with filtering', async () => {
      const orders = await orderApi.getCustomerOrders(10, 0);

      expect(orders).toBeDefined();
      expect(Array.isArray(orders)).toBe(true);

      const createdOrder = orders.find((order) => order.id === customerOrderId);
      expect(createdOrder).toBeDefined();
    }, 10000);

    // Customer order endpoint does not support PUT (405 Method Not Allowed)
    it('should reject updating a customer order', async () => {
      await expect(orderApi.updateCustomerOrder(customerOrderId, sampleUpdateOrderRequest)).rejects.toThrow();
    }, 10000);

    it('should get customer order status transitions', async () => {
      const transitions = await orderApi.getCustomerOrderStatusTransitions(customerOrderId);

      expect(transitions).toBeDefined();
      expect(Array.isArray(transitions)).toBe(true);
    }, 10000);
  });

  describe('Guest Checkout and Order Retrieval', () => {
    let guestOrderId: string;
    let guestCartId: string;
    const guestEmail = 'guest.test@example.com';
    let tokenManager: EmporixTokenManager;

    // Get token manager and clear tokens before all tests to prevent leakage
    // from previous describe blocks (e.g., customer login)
    beforeAll(async () => {
      tokenManager = container.get<EmporixTokenManager>('EmporixTokenManager');
      tokenManager.clearTokens(tenant);
      await apiInvoker.clearTokens();
    }, 10000);

    // Create a cart and add items before testing guest checkout
    beforeEach(async () => {
      guestCartId = await cartApi.createCart(sampleCreateCartRequest);
      expect(guestCartId).toBeDefined();

      const itemId = await cartApi.addItemToCart(guestCartId, sampleAddItemRequest);
      expect(itemId).toBeDefined();
    }, 15000);

    afterEach(async () => {
      try {
        if (guestCartId && !guestOrderId) {
          await cartApi.deleteCart(guestCartId);
        }
      } catch {
        // Ignore cleanup errors
      }
      guestOrderId = '';
    }, 10000);

    it('should create an order via guest checkout and retrieve it in the same session', async () => {
      const checkoutRequest = createCheckoutRequest(guestCartId, true, guestEmail);
      const checkoutResponse = await checkoutApi.guestCheckout(checkoutRequest);

      expect(checkoutResponse).toBeDefined();
      expect(checkoutResponse.orderId).toBeDefined();

      guestOrderId = checkoutResponse.orderId;

      // Retrieve the order using the customer order endpoint (same session)
      const retrievedOrder = await orderApi.getCustomerOrder(guestOrderId);

      expect(retrievedOrder).not.toBeNull();
      expect(retrievedOrder).toBeDefined();
      expect(retrievedOrder?.id).toBe(guestOrderId);
      expect(retrievedOrder?.customer.email).toBe(guestEmail);

      // Verify our order appears in the customer orders list
      const customerOrders = await orderApi.getCustomerOrders(10, 0);
      expect(customerOrders).toBeDefined();
      expect(Array.isArray(customerOrders)).toBe(true);

      const foundOrder = customerOrders.find((order) => order.id === guestOrderId);
      expect(foundOrder).toBeDefined();
    }, 60000);
  });
});
