import { Container } from 'inversify';
import EmporixCartApi from '../../cart/impl/EmporixCartApi';
import EmporixCheckoutApi from '../../checkout/impl/EmporixCheckoutApi';
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
  EmporixShipping,
} from '../../model';
import {
  EmporixApprovalAction,
  EmporixApprovalCreateRequest,
  EmporixApprovalPermittedRequest,
  EmporixApprovalResourceType,
  EmporixApprovalUpdateRequest,
} from '../../model/approval';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixApprovalApi from './EmporixApprovalApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  baseUrl: string = process.env.NEXT_EMPORIX_TEST_BASE_URL || 'https://api.emporix.io';
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || '';
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
    shippingTaxCode: 'STANDARD',
  };

  return {
    cartId,
    customer,
    addresses: [billingAddress, shippingAddress],
    paymentMethods: [paymentMethod],
    shipping,
  };
};

// Helper function to create an approval request
const createApprovalRequest = (
  cartId: string,
  checkoutRequest: EmporixCartCheckoutRequest,
  approverId: string,
  comment: string,
): EmporixApprovalCreateRequest => {
  return {
    resourceType: 'CART',
    action: 'CHECKOUT',
    resourceId: cartId,
    approver: {
      userId: approverId,
    },
    comment: comment,
    details: {
      currency: checkoutRequest.currency || sampleCreateCartRequest.currency,
      paymentMethods: checkoutRequest.paymentMethods,
      shipping: checkoutRequest.shipping,
      addresses: checkoutRequest.addresses,
    },
  };
};

describe('EmporixApprovalApi', () => {
  let container: Container;
  let approvalApi: EmporixApprovalApi;
  let checkoutApi: EmporixCheckoutApi;
  let cartApi: EmporixCartApi;
  let apiInvoker: EmporixApiInvoker;
  let customerApi: EmporixCustomerApi;

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
    container.bind<EmporixCheckoutApi>('EmporixCheckoutApi').to(EmporixCheckoutApi);
    container.bind<EmporixCustomerApi>('EmporixCustomerApi').to(EmporixCustomerApi);
    container.bind<EmporixApprovalApi>('EmporixApprovalApi').to(EmporixApprovalApi);

    // Get instances
    approvalApi = container.get<EmporixApprovalApi>('EmporixApprovalApi');
    checkoutApi = container.get<EmporixCheckoutApi>('EmporixCheckoutApi');
    cartApi = container.get<EmporixCartApi>('EmporixCartApi');
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    customerApi = container.get<EmporixCustomerApi>('EmporixCustomerApi');
  }, 15000);

  describe('Approval Flow with Order Creation', () => {
    // Helper function to set up customer token for a user that requires approval
    const username = 'benjamin.blue@alaba.ma'; // User that requires approval
    const approverUsername = 'forrest.gump@alaba.ma'; // User that can approve

    async function getOrCreateCustomerCartId() {
      const customerProfile = await customerApi.getCustomerProfile();
      const customerId = customerProfile.id;
      const createRequest: EmporixCreateCartRequest = {
        ...sampleCreateCartRequest,
        customerId,
      };

      try {
        return await cartApi.createCart(createRequest);
      } catch (error: any) {
        if (error?.message?.includes('409')) {
          const existingCart = await cartApi.getCartByCriteria(
            sampleCreateCartRequest.siteCode,
            undefined,
            customerId,
            sampleCreateCartRequest.type,
          );

          if (existingCart?.id) {
            return existingCart.id;
          }
        }

        throw error;
      }
    }

    async function setupCustomerToken() {
      try {
        // Login with test customer credentials
        const password = 'Test1234';

        // Use the customer API to login
        return await customerApi.login(username, password);
      } catch (error) {
        console.error('Error setting up customer token for approval flow:', error);
        throw error;
      }
    }

    async function setupApproverToken() {
      try {
        // Login with approver credentials
        const password = 'Test1234';

        // Use the customer API to login
        await customerApi.login(approverUsername, password);
      } catch (error) {
        console.error('Error setting up approver token:', error);
        throw error;
      }
    }

    let customerCartId: string;
    let orderId: string;
    let approvalId: string;

    beforeEach(async () => {
      // Set up a customer token with test user credentials
      const sessionContext = await setupCustomerToken();
      // Create or reuse a cart
      const cart: any = await cartApi.getCartByCriteria(
        'main',
        undefined,
        sessionContext.customerId,
        sampleCreateCartRequest.type,
        true,
      );
      customerCartId = cart?.id;

      expect(customerCartId).toBeDefined();

      // Add an item to the cart
      const itemId = await cartApi.addItemToCart(customerCartId, sampleAddItemRequest);
      expect(itemId).toBeDefined();
    }, 15000);

    afterEach(async () => {
      // Clean up: delete the approval if it was created
      if (approvalId) {
        try {
          await setupApproverToken();
          try {
            await approvalApi.deleteApproval(approvalId);
          } catch (deleteError: any) {
            if (!(deleteError.message && deleteError.message.includes('404'))) {
              throw deleteError;
            }
          }
        } catch (error) {
          console.error('Error cleaning up approval:', error);
        }
      }
      if (customerCartId) {
        try {
          await setupCustomerToken();
          try {
            await cartApi.deleteCart(customerCartId);
          } catch (deleteError: any) {
            if (!(deleteError.message && deleteError.message.includes('404'))) {
              throw deleteError;
            }
          }
        } catch (error) {
          console.error('Error cleaning up cart:', error);
        }
      }
    }, 15000);

    it('should create and update an approval for an order', async () => {
      try {
        // Create a checkout request for the cart
        const checkoutRequest = createSampleCheckoutRequest(customerCartId, false, username, '13360633');

        // Check if approval is required for this order
        const approvalPermittedRequest: EmporixApprovalPermittedRequest = {
          resourceType: 'CART',
          resourceId: customerCartId,
          action: 'CHECKOUT',
        };

        const permittedResponse = await approvalApi.checkApprovalPermitted(approvalPermittedRequest);

        // Verify the permitted response
        expect(permittedResponse).toBeDefined();
        expect(permittedResponse.permitted).toBe(false);

        const approval = await approvalApi.createApproval({
          resourceType: 'CART',
          action: 'CHECKOUT',
          resourceId: customerCartId,
          approver: {
            userId: '00632699', // Approver user ID
          },
          comment: 'Please approve this order',
          details: {
            currency: checkoutRequest.currency || sampleCreateCartRequest.currency,
            paymentMethods: checkoutRequest.paymentMethods,
            shipping: checkoutRequest.shipping,
            addresses: checkoutRequest.addresses,
          },
        });
        approvalId = approval.id;

        await setupApproverToken();

        await approvalApi.updateApproval(approval.id, [
          {
            op: 'replace',
            path: '/status',
            value: 'APPROVED',
          },
        ]);

        await setupCustomerToken();
        // Perform the checkout
        const checkoutResponse = await checkoutApi.checkout(checkoutRequest);
        // Verify the checkout response
        expect(checkoutResponse).toBeDefined();
        expect(checkoutResponse.orderId).toBeDefined();
        orderId = checkoutResponse.orderId;

        // If approval is required, there should be an approvalId
        if (!permittedResponse.permitted && permittedResponse.approvalId) {
          approvalId = permittedResponse.approvalId;

          // Get the approval details
          const approvalDetails = await approvalApi.getApproval(approvalId);

          // Verify the approval details
          expect(approvalDetails).not.toBeNull();
          if (approvalDetails) {
            expect(approvalDetails.id).toBe(approvalId);
            expect(approvalDetails.status).toBe('PENDING');
            expect(approvalDetails.resource).toBeDefined();
            expect(approvalDetails.resource.id).toBe(customerCartId);
          }
        }
      } catch (error) {
        console.error('Error creating approval:', error);
        throw error;
      }
    }, 20000);

    it('should create and update an approval for an order', async () => {
      // Create a checkout request for the cart
      const checkoutRequest = createSampleCheckoutRequest(customerCartId, false, username, '13360633');

      // Create an approval request
      const approvalRequest = createApprovalRequest(
        customerCartId,
        checkoutRequest,
        '00632699',
        'Please approve this order',
      );

      // Create the approval
      const createResponse = await approvalApi.createApproval(approvalRequest);
      expect(createResponse).toBeDefined();
      expect(createResponse.id).toBeDefined();
      approvalId = createResponse.id;

      // Switch to approver user
      await setupApproverToken();

      // Get the approval
      const approval = await approvalApi.getApproval(approvalId);
      expect(approval).not.toBeNull();
      if (approval) {
        expect(approval.status).toBe('PENDING');
      }

      // Update the approval to approve it
      const updateOperations: EmporixApprovalUpdateRequest[] = [
        {
          op: 'replace',
          path: '/status',
          value: 'APPROVED',
        },
        {
          op: 'add',
          path: '/approverComment',
          value: 'Order approved',
        },
      ];

      await approvalApi.updateApproval(approvalId, updateOperations);

      // Get the updated approval
      const updatedApproval = await approvalApi.getApproval(approvalId);
      expect(updatedApproval).not.toBeNull();
      if (updatedApproval) {
        expect(updatedApproval.status).toBe('APPROVED');
        expect(updatedApproval.approverComment).toBe('Order approved');
      }
    }, 20000);

    it('should list all approvals for the current user', async () => {
      // Create a checkout request for the cart
      const checkoutRequest = createSampleCheckoutRequest(customerCartId, false, username, '13360633');

      const approvalRequest = createApprovalRequest(
        customerCartId,
        checkoutRequest,
        '00632699',
        'Please approve this order',
      );
      const approval = await approvalApi.createApproval(approvalRequest);

      // Switch to approver user
      await setupApproverToken();

      // Get all approvals
      const approvals = await approvalApi.getApprovals();

      // Verify we got a list of approvals
      expect(Array.isArray(approvals)).toBe(true);

      // If there are approvals, check the structure of the first one
      if (approvals.length > 0) {
        const firstApproval = approvals[0];
        expect(firstApproval.id).toBeDefined();
        expect(firstApproval.status).toBeDefined();
        expect(firstApproval.resource).toBeDefined();
        expect(firstApproval.requestor).toBeDefined();
        expect(firstApproval.approver).toBeDefined();
      }
    }, 20000);

    it('should search for users who can be approvers', async () => {
      // Create a search request
      const searchRequest = {
        resourceType: 'CART' as EmporixApprovalResourceType,
        resourceId: customerCartId,
        action: 'CHECKOUT' as EmporixApprovalAction,
      };

      // Search for users
      const users = await approvalApi.searchApprovalUsers(searchRequest);

      // Verify we got a list of users
      expect(Array.isArray(users)).toBe(true);

      // If there are users, check the structure
      if (users.length > 0) {
        const firstUser = users[0];
        expect(firstUser.userId).toBeDefined();
        expect(firstUser.firstName).toBeDefined();
        expect(firstUser.lastName).toBeDefined();
      }
    }, 20000);

    it('should decline an approval for an order', async () => {
      // Create a checkout request for the cart
      const checkoutRequest = createSampleCheckoutRequest(customerCartId, false, username, '13360633');

      // Create an approval request
      const approvalRequest = createApprovalRequest(
        customerCartId,
        checkoutRequest,
        '00632699',
        'Please decline this order',
      );

      // Create the approval
      const createResponse = await approvalApi.createApproval(approvalRequest);
      approvalId = createResponse.id;

      // Switch to approver user
      await setupApproverToken();

      // Update the approval to decline it
      const updateOperations: EmporixApprovalUpdateRequest[] = [
        {
          op: 'replace',
          path: '/status',
          value: 'DECLINED',
        },
        {
          op: 'add',
          path: '/approverComment',
          value: 'Order declined due to budget constraints',
        },
      ];

      await approvalApi.updateApproval(approvalId, updateOperations);

      // Get the updated approval
      const updatedApproval = await approvalApi.getApproval(approvalId);
      expect(updatedApproval).not.toBeNull();
      if (updatedApproval) {
        expect(updatedApproval.status).toBe('DECLINED');
        expect(updatedApproval.approverComment).toBe('Order declined due to budget constraints');
      }

      setupCustomerToken();
      // Perform the checkout, which should fail
      await expect(checkoutApi.checkout(checkoutRequest)).rejects.toThrow();
    }, 20000);

    it('should require approval when checking permission with customer token', async () => {
      // Set up customer token
      await setupCustomerToken();

      // Create a permission check request
      const permissionRequest: EmporixApprovalPermittedRequest = {
        resourceType: 'CART',
        resourceId: customerCartId,
        action: 'CHECKOUT',
      };

      // Check if approval is permitted
      const permissionResponse = await approvalApi.checkApprovalPermitted(permissionRequest);

      // Verify that approval is required
      expect(permissionResponse).toBeDefined();
      expect(permissionResponse.permitted).toBe(false);
    }, 20000);
  });
});
