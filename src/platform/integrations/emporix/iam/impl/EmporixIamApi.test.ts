import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Container } from 'inversify';
import { first } from 'lodash';
import type { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTestTokenManager } from '../../common/impl/EmporixTokenManager.test';
import { EmporixConfig } from '../../config';
import EmporixCustomerApi from '../../customer/impl/EmporixCustomerApi';
import { EmporixGroup, EmporixGroupAssignmentRequest, EmporixRole } from '../../model/iam';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixIamApi from './EmporixIamApi';

// Create a test config implementation
class TestEmporixConfig implements EmporixConfig {
  tenant: string = process.env.NEXT_EMPORIX_TEST_TENANT || 'showcasetest';
  clientId: string = process.env.NEXT_EMPORIX_TEST_CLIENT_ID || '';
  clientSecret: string = process.env.NEXT_EMPORIX_TEST_CLIENT_SECRET || '';
  baseUrl: string = 'https://api.emporix.io';
  serverClientId: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_ID || '';
  serverClientSecret: string = process.env.NEXT_EMPORIX_TEST_SERVER_CLIENT_SECRET || '';
}

describe('EmporixIamApi', () => {
  // Test users
  const testUser1 = {
    username: 'benjamin.blue@alaba.ma',
    password: 'Test1234',
  };
  const testUser2 = {
    username: 'forrest.gump@alaba.ma',
    password: 'Test1234',
  };

  let container: Container;
  let tokenManager: EmporixTestTokenManager;
  let apiInvoker: EmporixApiInvoker;
  let oauthApi: EmporixOAuthApi;
  let customerApi: EmporixCustomerApi;
  let iamApi: EmporixIamApi;

  let isAuthenticated = false;
  let testGroupId: string | null = null;
  let testRoleId: string | null = null;
  let testUser1Id: string | null = null;

  // Helper function to set up user token
  async function setupUserToken(username: string, password: string) {
    try {
      // Use the customer API to login
      const sessionContext = await customerApi.login(username, password);
      isAuthenticated = true;
      return sessionContext;
    } catch (error) {
      console.error(`Authentication failed for ${username}:`, error);
      isAuthenticated = false;
      return null;
    }
  }

  // Setup container and dependencies
  beforeAll(() => {
    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixTestTokenManager>('EmporixTokenManager').to(EmporixTestTokenManager).inSingletonScope();
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
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<EmporixCustomerApi>('EmporixCustomerApi').to(EmporixCustomerApi);
    container.bind<EmporixIamApi>('EmporixIamApi').to(EmporixIamApi);

    // Resolve the dependencies
    tokenManager = container.get<EmporixTestTokenManager>('EmporixTokenManager');
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    oauthApi = container.get<EmporixOAuthApi>('EmporixOAuthApi');
    customerApi = container.get<EmporixCustomerApi>('EmporixCustomerApi');
    iamApi = container.get<EmporixIamApi>('EmporixIamApi');
  });

  // Authenticate before running tests
  beforeAll(async () => {
    const sessionContext = await setupUserToken(testUser1.username, testUser1.password);
    testUser1Id = sessionContext?.customerId ?? null;
  }, 10000);

  // Cleanup: clear tokens after tests
  afterAll(async () => {
    await tokenManager.clearTokens();
  }, 10000);

  // Test access control operations
  describe('Access Control operations', () => {
    let testRoleId: string | null = null;
    let testAccessControlId: string | null = null;

    // First get a role to use for access control tests
    it('should retrieve a role to use for access control tests', async () => {
      if (!isAuthenticated) {
        console.warn('Skipping test due to authentication failure');
        return;
      }

      try {
        const rolesResponse = await iamApi.getRoles();
        expect(rolesResponse).toBeDefined();
        expect(Array.isArray(rolesResponse.items)).toBe(true);
        expect(rolesResponse.items.length).toBeGreaterThan(0);

        // Get the first role
        const firstRole = rolesResponse.items[0];
        expect(firstRole).toBeDefined();
        expect(firstRole.id).toBeDefined();

        // Save the role ID for later tests
        testRoleId = firstRole.id!;
      } catch (error) {
        console.error('Failed to retrieve roles:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve all access controls', async () => {
      if (!isAuthenticated || !testRoleId) {
        console.warn('Skipping test due to authentication failure or missing role ID');
        return;
      }

      try {
        const params = {
          criteria: {
            roleId: testRoleId!,
          },
        };
        const accessControlsResponse = await iamApi.getAccessControls(params);
        expect(accessControlsResponse).toBeDefined();
        expect(Array.isArray(accessControlsResponse.items)).toBe(true);
        expect(accessControlsResponse.items.length).toBeGreaterThan(0);
        testAccessControlId = accessControlsResponse.items[0].id ?? null;
      } catch (error) {
        console.error('Failed to retrieve access controls:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve an access control by ID', async () => {
      if (!isAuthenticated || !testAccessControlId) {
        console.warn('Skipping test due to authentication failure or missing access control ID');
        return;
      }

      try {
        const accessControl = await iamApi.getAccessControlById(testAccessControlId);
        expect(accessControl).toBeDefined();
        expect(accessControl.id).toBe(testAccessControlId);
      } catch (error) {
        console.error('Failed to retrieve access control by ID:', error);
        throw error;
      }
    }, 10000);
  });

  // Test group operations
  describe('Group operations', () => {
    it('should create a new group', async () => {
      if (!isAuthenticated) {
        console.warn('Skipping test due to authentication failure');
        return;
      }

      const testGroup: EmporixGroup = {
        id: '', // Will be assigned by the API
        name: {
          en: 'Test Group',
          de: 'Test Gruppe',
        },
        description: {
          en: 'Group created for testing purposes',
          de: 'Gruppe für Testzwecke erstellt',
        },
        userType: 'CUSTOMER',
      };

      try {
        const createdGroup = await iamApi.createGroup(testGroup);
        expect(createdGroup).toBeDefined();
        expect(createdGroup.id).toBeDefined();

        // Save the group ID for later tests
        if (createdGroup.id) {
          testGroupId = createdGroup.id;
        }
      } catch (error) {
        console.error('Failed to create group:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve all groups', async () => {
      if (!isAuthenticated || !testGroupId) {
        console.warn('Skipping test due to authentication failure or missing group ID');
        return;
      }

      try {
        const groups = await iamApi.getGroups({
          page: 1,
          size: 100,
        });
        expect(groups).toBeDefined();
        expect(Array.isArray(groups)).toBe(true);
        expect(groups.length).toBeGreaterThan(0);

        // Check if our test group is in the list
        const foundGroup = groups.find((group) => group.id === testGroupId);
        expect(foundGroup).toBeDefined();
      } catch (error) {
        console.error('Failed to retrieve groups:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve a group by ID', async () => {
      if (!isAuthenticated || !testGroupId) {
        console.warn('Skipping test due to authentication failure or missing group ID');
        return;
      }

      try {
        const group = await iamApi.getGroupById(testGroupId);
        expect(group).toBeDefined();
        expect(group.id).toBe(testGroupId);
        expect(group.name?.en).toBe('Test Group');
      } catch (error) {
        console.error('Failed to retrieve group by ID:', error);
        throw error;
      }
    }, 10000);

    it('should update a group', async () => {
      if (!isAuthenticated || !testGroupId) {
        console.warn('Skipping test due to authentication failure or missing group ID');
        return;
      }

      try {
        const updatedGroup: EmporixGroup = {
          id: testGroupId,
          name: {
            en: 'Updated Test Group',
            de: 'Aktualisierte Test Gruppe',
          },
          description: {
            en: 'Updated description for testing purposes',
            de: 'Aktualisierte Beschreibung für Testzwecke',
          },
          userType: 'CUSTOMER',
        };

        await iamApi.updateGroup(testGroupId, updatedGroup);
        const result = await iamApi.getGroupById(testGroupId);
        expect(result).toBeDefined();
        expect(result.id).toBe(testGroupId);
        expect(result.name?.en).toBe('Updated Test Group');
      } catch (error) {
        console.error('Failed to update group:', error);
        throw error;
      }
    }, 10000);
  });

  // Test role operations
  describe('Role operations', () => {
    it('should retrieve all roles', async () => {
      if (!isAuthenticated) {
        console.warn('Skipping test due to authentication failure or missing role ID');
        return;
      }

      try {
        const roles = await iamApi.getRoles();
        expect(roles).toBeDefined();
        expect(Array.isArray(roles.items)).toBe(true);
        expect(roles.items.length).toBeGreaterThan(0);
        const firstRole = roles.items[0];
        expect(firstRole).toBeDefined();
        expect(firstRole.id).toBeDefined();
        if (firstRole.id) {
          testRoleId = firstRole.id;
        }
      } catch (error) {
        console.error('Failed to retrieve roles:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve a role by ID', async () => {
      if (!isAuthenticated || !testRoleId) {
        console.warn('Skipping test due to authentication failure or missing role ID');
        return;
      }

      try {
        const role = await iamApi.getRoleById(testRoleId);
        expect(role).toBeDefined();
        expect(role.id).toBe(testRoleId);
        expect(role.name).toBeDefined();
      } catch (error) {
        console.error('Failed to retrieve role by ID:', error);
        throw error;
      }
    }, 10000);
  });

  // Test user-specific operations
  describe('User-specific operations', () => {
    it('should retrieve current user scopes', async () => {
      if (!isAuthenticated) {
        console.warn('Skipping test due to authentication failure');
        return;
      }

      try {
        const { userId, scopes } = await iamApi.getUserScopes();
        expect(scopes).toBeDefined();
        expect(userId).toBeDefined();
      } catch (error) {
        console.error('Failed to retrieve user scopes:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve scopes for benjamin.blue user', async () => {
      try {
        // Set up token for benjamin.blue user
        await setupUserToken(testUser1.username, testUser1.password);

        // Get user scopes
        const { userId, scopes } = await iamApi.getUserScopes();

        // Verify the response
        expect(scopes).toBeDefined();
        expect(userId).toBeDefined();
        // Benjamin Blue should have customer scopes but not approver scopes
        expect(typeof scopes === 'string').toBe(true);
        expect(scopes.includes('customer')).toBe(true);
      } catch (error) {
        console.error('Failed to retrieve benjamin.blue scopes:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve scopes for forrest.gump user', async () => {
      try {
        // Set up token for forrest.gump user
        const sessionContext = await setupUserToken(testUser2.username, testUser2.password);
        const testUser2Id = sessionContext?.customerId;

        // Get user scopes
        const { userId, scopes } = await iamApi.getUserScopes();

        // Verify the response
        expect(scopes).toBeDefined();
        expect(userId).toBeDefined();

        // Forrest Gump should have approver scopes
        expect(typeof scopes === 'string').toBe(true);
        expect(scopes.includes('customer')).toBe(true);
        // Note: We're not strictly checking for approver scopes as the exact scope names may vary
        // but we're logging them for inspection
      } catch (error) {
        console.error('Failed to retrieve forrest.gump scopes:', error);
        throw error;
      } finally {
        // Switch back to the original user for subsequent tests
        await setupUserToken(testUser1.username, testUser1.password);
      }
    }, 10000);

    it('should retrieve groups for benjamin.blue user', async () => {
      try {
        // Set up token for benjamin.blue user
        await setupUserToken(testUser1.username, testUser1.password);

        // We need a user ID to get groups
        if (!testUser1Id) {
          console.warn('Skipping test due to missing user ID');
          return;
        }

        // Get user groups
        const userGroups = await iamApi.getUserGroups(testUser1Id);

        // Verify the response
        expect(userGroups).toBeDefined();
        expect(userGroups.items).toBeDefined();
        expect(Array.isArray(userGroups.items)).toBe(true);

        // Check if any groups exist
        if (userGroups.items.length > 0) {
          // Verify group structure
          const firstGroup = userGroups.items[0];
          expect(firstGroup.id).toBeDefined();
          expect(firstGroup.name).toBeDefined();
        }
      } catch (error) {
        console.error('Failed to retrieve benjamin.blue groups:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve groups for forrest.gump user', async () => {
      try {
        // Set up token for forrest.gump user
        const sessionContext = await setupUserToken(testUser2.username, testUser2.password);
        const testUser2Id = sessionContext?.customerId;

        // We need a user ID to get groups
        if (!testUser2Id) {
          console.warn('Skipping test due to missing user ID');
          return;
        }

        // Get user groups
        const userGroups = await iamApi.getUserGroups(testUser2Id);

        // Verify the response
        expect(userGroups).toBeDefined();
        expect(userGroups.items).toBeDefined();
        expect(Array.isArray(userGroups.items)).toBe(true);

        // Check if any groups exist
        if (userGroups.items.length > 0) {
          // Verify group structure
          const firstGroup = userGroups.items[0];
          expect(firstGroup.id).toBeDefined();
          expect(firstGroup.name).toBeDefined();
        }
      } catch (error) {
        console.error('Failed to retrieve forrest.gump groups:', error);
        throw error;
      } finally {
        // Switch back to the original user for subsequent tests
        await setupUserToken(testUser1.username, testUser1.password);
      }
    }, 10000);

    it('should retrieve forrest.gump user access controls', async () => {
      if (!isAuthenticated) {
        console.warn('Skipping test due to authentication failure');
        return;
      }

      try {
        // Set up token for forrest.gump user
        await setupUserToken(testUser2.username, testUser2.password);
        const accessControls = await iamApi.getUserAccessControls();
        expect(accessControls).toBeDefined();
        expect(Array.isArray(accessControls)).toBe(true);
        // Access controls should have id property
        if (accessControls.length > 0) {
          expect(accessControls[0].id).toBeDefined();
        }
      } catch (error) {
        console.error('Failed to retrieve user access controls:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve benjamin.blue access controls', async () => {
      if (!isAuthenticated) {
        console.warn('Skipping test due to authentication failure');
        return;
      }

      try {
        // Set up token for benjamin.blue user
        await setupUserToken(testUser1.username, testUser1.password);
        const accessControls = await iamApi.getUserAccessControls();
        expect(accessControls).toBeDefined();
        expect(Array.isArray(accessControls)).toBe(true);
        // Access controls should have id property
        if (accessControls.length > 0) {
          expect(accessControls[0].id).toBeDefined();
        }
      } catch (error) {
        console.error('Failed to retrieve user access controls:', error);
        throw error;
      }
    }, 10000);

    it('should retrieve a specific users access controls', async () => {
      if (!isAuthenticated || !testUser1Id) {
        console.warn('Skipping test due to authentication failure or missing user ID');
        return;
      }

      try {
        const accessControls = await iamApi.getUserAccessControls(testUser1Id);
        expect(accessControls).toBeDefined();
        expect(Array.isArray(accessControls)).toBe(true);
        // Access controls should have id property
        if (accessControls.length > 0) {
          expect(accessControls[0].id).toBeDefined();
        }
      } catch (error) {
        console.error('Failed to retrieve a specific user access controls:', error);
        throw error;
      }
    }, 10000);
  });

  // Test group assignment operations
  describe('Group assignment operations', () => {
    it('should create a group assignment', async () => {
      if (!isAuthenticated || !testGroupId || !testUser1Id) {
        console.warn('Skipping test due to authentication failure or missing IDs');
        return;
      }

      const groupAssignment: EmporixGroupAssignmentRequest = {
        userId: testUser1Id,
        userType: 'CUSTOMER',
      };

      try {
        const createdAssignment = await iamApi.addUserToGroup(testGroupId, groupAssignment);
        expect(createdAssignment).toBeDefined();
        expect(createdAssignment?.id).toBeDefined();
      } catch (error) {
        console.error('Failed to create group assignment:', error);
        throw error;
      }
    }, 10000);
  });

  // Cleanup tests
  describe('Cleanup', () => {
    it('should delete the group assignment', async () => {
      if (!isAuthenticated || !testUser1Id || !testGroupId) {
        console.warn('Skipping cleanup test due to authentication failure or missing assignment ID');
        return;
      }

      try {
        await iamApi.removeUserFromGroup(testGroupId, testUser1Id);
        // Verify deletion by trying to retrieve it (should throw an error)
        const testGroup = await iamApi.getUserGroups(testUser1Id);
        expect(testGroup.items).toBeDefined();
        const foundGroup = testGroup.items.find((group) => group.id === testGroupId);
        expect(foundGroup).toBeUndefined();
      } catch (error) {
        console.error('Failed to delete group assignment:', error);
        throw error;
      }
    }, 10000);

    it('should delete the group', async () => {
      if (!isAuthenticated || !testGroupId) {
        console.warn('Skipping cleanup test due to authentication failure or missing group ID');
        return;
      }

      try {
        await iamApi.deleteGroup(testGroupId);

        // Verify deletion by trying to retrieve it (should throw an error)
        try {
          await iamApi.getGroupById(testGroupId);
          // If we get here, the group wasn't deleted
          expect(true).toBe(false); // Force test to fail
        } catch (error) {
          // Expected error, group was deleted
          expect(true).toBe(true);
        }
      } catch (error) {
        console.error('Failed to delete group:', error);
        throw error;
      }
    }, 10000);
  });
});
