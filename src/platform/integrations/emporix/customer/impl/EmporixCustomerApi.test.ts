import { Container } from 'inversify';
import { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import { EmporixCustomerAddress, EmporixPasswordChangeRequest } from '../../model/customer';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixCustomerApi from './EmporixCustomerApi';

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

// Sample address for testing
const sampleAddress: Partial<EmporixCustomerAddress> = {
  contactName: 'Test Customer',
  companyName: 'Test Company',
  street: 'Test Street',
  zipCode: '12345',
  city: 'Test City',
  country: 'DE',
};

describe('EmporixCustomerApi', () => {
  let container: Container;
  let customerApi: EmporixCustomerApi;
  let oauthApi: EmporixOAuthApi;
  let apiInvoker: EmporixApiInvoker;
  let tokenManager: EmporixTokenManager;

  // Set up the DI container and create instances before all tests
  beforeAll(() => {
    // Create a new container for dependency injection
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').toConstantValue(new TestEmporixConfig());
    container.bind<EmporixTokenManager>('EmporixTokenManager').to(EmporixTestTokenManager).inSingletonScope();
    container.bind<EmporixApiInvoker>('EmporixApiInvoker').to(EmporixApiInvoker).inSingletonScope();
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi).inSingletonScope();
    container.bind<EmporixCustomerApi>('EmporixCustomerApi').to(EmporixCustomerApi).inSingletonScope();

    // Get instances from the container
    customerApi = container.get<EmporixCustomerApi>('EmporixCustomerApi');
    oauthApi = container.get<EmporixOAuthApi>('EmporixOAuthApi');
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    tokenManager = container.get<EmporixTokenManager>('EmporixTokenManager');

    // Clear any existing tokens to ensure a fresh session
    tokenManager.clearTokens(tenant);
  }, 10000);

  // Tests for authenticated customer API operations
  describe('Customer Address Management', () => {
    // Create a test user session before tests
    beforeAll(async () => {
      // Get a session token if needed
      try {
        // Check if we need to authenticate
        const username = 'forrest.gump@alaba.ma';
        const password = 'Test1234';
        if (username && password) {
          // Login with the test credentials if available
          await customerApi.login(username, password);
        } else {
          throw new Error('Test credentials not found');
        }
      } catch (error) {
        console.error('Error during test setup authentication:', error);
        throw error;
      }
    }, 15000);

    // Clean up after all tests
    afterAll(async () => {
      // Clear tokens
      await tokenManager.clearTokens(tenant);
    }, 10000);

    it('should get customer addresses', async () => {
      try {
        // Call the getCustomerAddresses function
        const addresses = await customerApi.getCustomerAddresses();

        // Verify we got an array of addresses
        expect(addresses).toBeDefined();
        expect(Array.isArray(addresses)).toBe(true);

        // Even if the user has no addresses, we should get an empty array
        // rather than an error
        if (addresses.length > 0) {
          // If addresses exist, verify they have the expected structure
          const firstAddress = addresses[0];
          expect(firstAddress).toHaveProperty('id');
          expect(firstAddress).toHaveProperty('country');
          // Add more field checks as needed for your address structure
        }
      } catch (error) {
        console.error('Error getting customer addresses:', error);
        throw error;
      }
    }, 10000);

    // Tests for other address management functions
    it('should add a customer address and then delete it', async () => {
      try {
        // Generate a unique test address to avoid conflicts
        const uniqueTestAddress: Partial<EmporixCustomerAddress> = {
          ...sampleAddress,
          contactName: `Test Customer ${Date.now()}`, // Add timestamp for uniqueness
          tags: ['SHIPPING'],
        };
        // Step 1: Add a new address
        const result = await customerApi.addCustomerAddress(uniqueTestAddress);
        // Verify the result has an ID
        expect(result).toBeDefined();
        expect(result.id).toBeDefined();

        // Store the ID for cleanup or further tests
        const addressId = result.id;

        // Step 2: Verify the address was added by retrieving all addresses
        const addresses = await customerApi.getCustomerAddresses();
        const addedAddress = addresses.find((addr) => addr.id === addressId);

        expect(addedAddress).toBeDefined();
        expect(addedAddress?.contactName).toBe(uniqueTestAddress.contactName);
        expect(addedAddress?.street).toBe(uniqueTestAddress.street);
        expect(addedAddress?.city).toBe(uniqueTestAddress.city);

        // Step 3: Clean up - delete the test address
        // Da deleteCustomerAddress void zurückgibt, testen wir, dass es ohne Fehler ausgeführt wird
        let deleteError = null;
        try {
          await customerApi.deleteCustomerAddress(addressId);
        } catch (error) {
          console.error('Error deleting address:', error);
          deleteError = error;
        }
        expect(deleteError).toBeNull();

        // Step 4: Verify the address was deleted
        const addressesAfterDelete = await customerApi.getCustomerAddresses();
        const addressExists = addressesAfterDelete.some((addr) => addr.id === addressId);
        expect(addressExists).toBe(false);
      } catch (error) {
        console.error('Error in address creation/deletion test:', error);
        throw error;
      }
    }, 15000);

    it('should update a customer address', async () => {
      try {
        // Step 1: Create a test address to update
        const initialAddress: Partial<EmporixCustomerAddress> = {
          ...sampleAddress,
          contactName: `Update Test Customer ${Date.now()}`,
          tags: ['SHIPPING'],
        };

        // Add the initial address
        const createResult = await customerApi.addCustomerAddress(initialAddress);
        expect(createResult).toBeDefined();
        expect(createResult.id).toBeDefined();
        const addressId = createResult.id;

        // Step 2: Update the address
        const updatedData: Partial<EmporixCustomerAddress> = {
          contactName: `Updated Customer ${Date.now()}`,
          companyName: 'Updated Company Name',
          street: 'Updated Street',
          streetNumber: '42',
          zipCode: '54321',
          city: 'Updated City',
          tags: ['SHIPPING', 'BILLING'], // Add billing tag
        };

        await customerApi.updateCustomerAddress(addressId, updatedData);

        // Step 3: Verify the update was successful
        const addresses = await customerApi.getCustomerAddresses();
        const updatedAddress = addresses.find((addr) => addr.id === addressId);

        expect(updatedAddress).toBeDefined();
        expect(updatedAddress?.contactName).toBe(updatedData.contactName);
        expect(updatedAddress?.companyName).toBe(updatedData.companyName);
        expect(updatedAddress?.street).toBe(updatedData.street);
        expect(updatedAddress?.streetNumber).toBe(updatedData.streetNumber);
        expect(updatedAddress?.zipCode).toBe(updatedData.zipCode);
        expect(updatedAddress?.city).toBe(updatedData.city);

        // Check that both tags are present (could be in any order)
        expect(updatedAddress?.tags).toContain('SHIPPING');
        expect(updatedAddress?.tags).toContain('BILLING');

        // Step 4: Clean up - delete the test address
        let deleteError = null;
        try {
          await customerApi.deleteCustomerAddress(addressId);
        } catch (error) {
          console.error('Error deleting address:', error);
          deleteError = error;
        }
        expect(deleteError).toBeNull();

        // Verify deletion
        const addressesAfterDelete = await customerApi.getCustomerAddresses();
        const addressExists = addressesAfterDelete.some((addr) => addr.id === addressId);
        expect(addressExists).toBe(false);
      } catch (error) {
        console.error('Error in address update test:', error);
        throw error;
      }
    }, 15000);
  });

  describe('Password Management', () => {
    // Store original credentials for later use
    let originalUsername: string;
    let originalPassword: string;
    const tempPassword = `Temp${Date.now()}Password!`;

    // Set up credentials before tests
    beforeAll(async () => {
      try {
        // Get test credentials
        originalUsername = 'forrest.gump@alaba.ma';
        originalPassword = 'Test1234';

        if (!originalUsername || !originalPassword) {
          throw new Error('Test credentials not found');
        }

        // Login with the original credentials
        await customerApi.login(originalUsername, originalPassword);
      } catch (error) {
        console.error('Error during test setup authentication:', error);
        throw error;
      }
    }, 15000);

    // Clean up after all tests - ensure password is restored
    afterAll(async () => {
      // Clear tokens before logging out
      await tokenManager.clearTokens(tenant);
    }, 10000);

    it('should change password and then revert back to original', async () => {
      // Skip this test if we don't have valid credentials
      if (!originalUsername || !originalPassword) {
        return;
      }

      try {
        // Step 1: Change password from original to temp
        const firstChangeData: EmporixPasswordChangeRequest = {
          currentPassword: originalPassword,
          newPassword: tempPassword,
        };

        await customerApi.changePassword(firstChangeData);

        // Step 2: Verify we can login with the new password
        // First clear the token to force a new login
        await tokenManager.clearTokens(tenant);

        // Try logging in with the new password
        await customerApi.login(originalUsername, tempPassword);

        // Step 3: Change password back to original
        const secondChangeData: EmporixPasswordChangeRequest = {
          currentPassword: tempPassword,
          newPassword: originalPassword,
        };

        await customerApi.changePassword(secondChangeData);

        // Step 4: Verify we can login with the original password again
        // Clear token to force a new login
        await tokenManager.clearTokens(tenant);

        // Try logging in with the original password
        await customerApi.login(originalUsername, originalPassword);
      } catch (error) {
        console.error('Error in password change test:', error);

        // Emergency restoration of original password if something fails
        try {
          // Try to login with temp password first
          await tokenManager.clearTokens(tenant);
          await customerApi.login(originalUsername, tempPassword);

          // Change back to original
          const emergencyChangeData: EmporixPasswordChangeRequest = {
            currentPassword: tempPassword,
            newPassword: originalPassword,
          };
          await customerApi.changePassword(emergencyChangeData);
        } catch (restoreError) {
          console.error('Failed emergency password restoration:', restoreError);
        }

        fail(`Password change test failed: ${error}`);
      }
    }, 30000);
  });

  describe('Profile Management', () => {
    // Store original profile data for restoration
    let originalProfile: any;
    let isAuthenticated = false;

    // Set up credentials before tests
    beforeAll(async () => {
      try {
        // Get test credentials
        const username = 'forrest.gump@alaba.ma';
        const password = 'Test1234';

        if (!username || !password) {
          throw new Error('Test credentials not found');
        }

        // Login with the test credentials
        await customerApi.login(username, password);
        isAuthenticated = true;

        // Get original profile data to restore later
        originalProfile = await customerApi.getCustomerProfile();
      } catch (error) {
        console.error('Error during profile test setup:', error);
        throw error;
      }
    }, 15000);

    // Clean up after all tests - restore original profile data
    afterAll(async () => {
      if (isAuthenticated && originalProfile) {
        try {
          // Restore the original profile data
          await customerApi.updateCustomerProfile({
            firstName: originalProfile.firstName,
            lastName: originalProfile.lastName,
            contactPhone: originalProfile.contactPhone,
            company: originalProfile.company,
            preferredLanguage: originalProfile.preferredLanguage,
          });
        } catch (error) {
          console.error('Error restoring original profile data:', error);
        }
      }

      // Clear tokens
      await tokenManager.clearTokens(tenant);
    }, 10000);

    it('should update customer profile and verify changes', async () => {
      if (!isAuthenticated) {
        return;
      }

      try {
        // Step 1: Create profile update data
        const timestamp = Date.now();
        const updateData = {
          firstName: `ForrestTest${timestamp}`,
          lastName: `GumpTest${timestamp}`,
          contactPhone: `123-456-${timestamp % 10000}`,
          company: `Bubba Gump Test Co ${timestamp}`,
          preferredLanguage: 'de_DE',
        };

        // Step 2: Update the profile
        await customerApi.updateCustomerProfile(updateData);

        // Step 3: Verify the profile was updated by retrieving it
        const updatedProfile = await customerApi.getCustomerProfile();

        // Verify each updated field
        expect(updatedProfile.firstName).toBe(updateData.firstName);
        expect(updatedProfile.lastName).toBe(updateData.lastName);
        expect(updatedProfile.contactPhone).toBe(updateData.contactPhone);
        expect(updatedProfile.company).toBe(updateData.company);
        expect(updatedProfile.preferredLanguage).toBe(updateData.preferredLanguage);
      } catch (error) {
        console.error('Error in profile update test:', error);
        fail(`Profile update test failed: ${error}`);
      }
    }, 15000);
  });
});
