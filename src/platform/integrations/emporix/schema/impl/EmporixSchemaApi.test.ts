import { Container, inject } from 'inversify';
import { StoredToken } from '@/platform/integrations/types/auth';
import type { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTokenManagerAbstract, TokenStore } from '../../common/impl/EmporixTokenManagerAbstract';
import { EmporixConfig } from '../../config';
import { EmporixCustomEntity, EmporixPatchOperation } from '../../model/schema';
import EmporixOAuthApi from '../../oauth/impl/EmporixOAuthApi';
import EmporixSchemaApi from './EmporixSchemaApi';

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
  private tokenStore: Map<string, StoredToken<any>> = new Map();
  protected async readToken<T extends StoredToken<K>, K>(
    type: 'anonymous' | 'customer' | 'service',
  ): Promise<T | undefined> {
    return this.tokenStore.get(type) as T | undefined;
  }
  protected writeToken<T extends StoredToken<K>, K>(
    type: 'anonymous' | 'customer' | 'service',
    token: T | undefined,
  ): Promise<void> {
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

// Sample custom instance creation request
const sampleCustomInstanceCreation: EmporixCustomEntity = {
  id: 'test-instance-1',
  name: { en: 'Test Instance 1' },
  type: 'test-entity-type',
  mixins: {
    entity: {
      name: 'Test Entity',
      description: 'A test entity for unit testing',
      active: true,
      price: 99.99,
    },
  },
};

// Sample patch operations
const samplePatchOperations: EmporixPatchOperation[] = [
  {
    op: 'replace',
    path: '/mixins/entity/price',
    value: 129.99,
  },
  {
    op: 'replace',
    path: '/mixins/entity/description',
    value: 'Updated test entity description',
  },
];

describe('EmporixSchemaApi', () => {
  let container: Container;
  let schemaApi: EmporixSchemaApi;
  let apiInvoker: EmporixApiInvoker;
  let createdSchemaId: string;
  let createdCustomTypeId: string;
  let createdCustomInstanceId: string;

  beforeAll(async () => {
    // Set up the container with our test config
    container = new Container();
    container.bind<EmporixConfig>('EmporixConfig').to(TestEmporixConfig);
    container.bind<EmporixOAuthApi>('EmporixOAuthApi').to(EmporixOAuthApi);
    container.bind<EmporixTokenManager>('EmporixTokenManager').to(TestTokenManager);
    container.bind<EmporixApiInvoker>('EmporixApiInvoker').to(EmporixApiInvoker);
    container.bind<EmporixSchemaApi>('EmporixSchemaApi').to(EmporixSchemaApi);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    schemaApi = container.get<EmporixSchemaApi>('EmporixSchemaApi');
  });

  afterAll(async () => {
    // Clean up any tokens
    await apiInvoker.clearTokens();
  });
  // TODO: Enable tests when Test Data is in place
  describe.skip('Schema Operations', () => {
    describe.skip('Custom Instance Operations', () => {
      it('should create a custom instance', async () => {
        // Create a custom instance
        createdCustomInstanceId = await schemaApi.createCustomEntity('TEST_ENTITY', sampleCustomInstanceCreation);

        // Verify the custom instance was created
        expect(createdCustomInstanceId).toBeDefined();
        expect(typeof createdCustomInstanceId).toBe('string');
        expect(createdCustomInstanceId).toBe(sampleCustomInstanceCreation.id);
      }, 10000);

      let customInstance: EmporixCustomEntity | undefined;
      it('should get a custom instance by ID', async () => {
        // Get the custom instance we just created
        customInstance = await schemaApi.getCustomEntity('TEST_ENTITY', createdCustomInstanceId);

        // Verify the custom instance details
        expect(customInstance).toBeDefined();
        expect(customInstance?.id).toBe(createdCustomInstanceId);
        expect(customInstance?.name).toEqual(sampleCustomInstanceCreation.name);
        expect(customInstance?.type).toBe('TEST_ENTITY');
        expect(customInstance?.mixins?.entity).toBeDefined();
      }, 10000);

      it('should get all custom instances for a type', async () => {
        // Get all custom instances for the type
        const customInstances = await schemaApi.getCustomEntities('TEST_ENTITY', {});

        // Verify custom instances were returned
        expect(customInstances).toBeDefined();
        expect(Array.isArray(customInstances.items)).toBe(true);
        expect(customInstances.items.length).toBeGreaterThan(0);

        // Find our created custom instance
        const createdInstance = customInstances.items.find((i) => i.id === createdCustomInstanceId);
        expect(createdInstance).toBeDefined();
      }, 10000);

      it('should update a custom instance', async () => {
        // Update the custom instance with a new name
        const updatedName = { en: 'Updated Test Instance' };
        await schemaApi.updateCustomEntity('TEST_ENTITY', createdCustomInstanceId, {
          name: updatedName,
          type: 'TEST_ENTITY',
          mixins: sampleCustomInstanceCreation.mixins,
        });

        // Get the updated custom instance
        const updatedInstance = await schemaApi.getCustomEntity('TEST_ENTITY', createdCustomInstanceId);

        // Verify the name was updated
        expect(updatedInstance).toBeDefined();
        expect(updatedInstance?.name).toEqual(updatedName);
      }, 10000);

      it('should patch a custom instance', async () => {
        // Patch the custom instance
        await schemaApi.patchCustomEntity('TEST_ENTITY', createdCustomInstanceId, samplePatchOperations);

        // Get the patched custom instance
        const patchedInstance = await schemaApi.getCustomEntity('TEST_ENTITY', createdCustomInstanceId);

        // Verify the patch was applied
        expect(patchedInstance).toBeDefined();
        expect(patchedInstance?.mixins?.entity.price).toBe(129.99);
        expect(patchedInstance?.mixins?.entity.description).toBe('Updated test entity description');
      }, 10000);

      it('should search custom instances', async () => {
        // Search for custom instances
        const searchResults = await schemaApi.searchCustomEntities('TEST_ENTITY', { criteria: { name: 'Test' } });

        // Verify search results were returned
        expect(searchResults).toBeDefined();
        expect(Array.isArray(searchResults.items)).toBe(true);
        expect(searchResults.items.length).toBeGreaterThan(0);
      }, 10000);

      it('should create custom instances in bulk', async () => {
        // Create bulk instances
        const bulkInstances: EmporixCustomEntity[] = [
          {
            id: 'bulk-test-1',
            type: 'TEST_ENTITY',
            name: { en: 'Bulk Test 1' },
            mixins: {
              entity: {
                name: 'Bulk Entity 1',
                active: true,
              },
            },
          },
          {
            id: 'bulk-test-2',
            type: 'TEST_ENTITY',
            name: { en: 'Bulk Test 2' },
            mixins: {
              entity: {
                name: 'Bulk Entity 2',
                active: false,
              },
            },
          },
        ];

        const bulkResponse = await schemaApi.createCustomEntitiesBulk('TEST_ENTITY', bulkInstances);

        // Verify bulk response
        expect(bulkResponse).toBeDefined();
        expect(Array.isArray(bulkResponse)).toBe(true);
        expect(bulkResponse.length).toBe(bulkInstances.length);
        expect(bulkResponse[0].status).toBeDefined();
      }, 10000);

      it('should update custom instances in bulk', async () => {
        // Update bulk instances
        const bulkUpdates: EmporixCustomEntity[] = [
          {
            id: 'bulk-test-1',
            type: 'TEST_ENTITY',
            name: { en: 'Updated Bulk Test 1' },
            mixins: {
              entity: {
                name: 'Updated Bulk Entity 1',
                active: false,
              },
            },
          },
          {
            id: 'bulk-test-2',
            type: 'TEST_ENTITY',
            name: { en: 'Updated Bulk Test 2' },
            mixins: {
              entity: {
                name: 'Updated Bulk Entity 2',
                active: true,
              },
            },
          },
        ];

        const bulkResponse = await schemaApi.updateCustomEntitiesBulk('TEST_ENTITY', bulkUpdates);

        // Verify bulk response
        expect(bulkResponse).toBeDefined();
        expect(Array.isArray(bulkResponse)).toBe(true);
        expect(bulkResponse.length).toBe(bulkUpdates.length);
        expect(bulkResponse[0].status).toBeDefined();
      }, 10000);

      it('should delete custom instances in bulk', async () => {
        // Delete bulk instances
        const bulkIds = ['bulk-test-1', 'bulk-test-2'];
        const bulkResponse = await schemaApi.deleteCustomEntitiesBulk('TEST_ENTITY', bulkIds);

        // Verify bulk response
        expect(bulkResponse).toBeDefined();
        expect(Array.isArray(bulkResponse)).toBe(true);
        expect(bulkResponse.length).toBe(bulkIds.length);
        expect(bulkResponse[0].status).toBeDefined();
      }, 10000);
    });

    describe('Error Handling', () => {
      it('should throw error when getting non-existent custom instance', async () => {
        // Attempt to get a non-existent custom instance
        const nonExistentInstanceId = 'non-existent-instance-id';

        // Expect the operation to throw an error
        await expect(schemaApi.getCustomEntity('TEST_ENTITY', nonExistentInstanceId)).rejects.toThrow();
      }, 10000);
    });

    describe('Cleanup', () => {
      it('should delete a custom instance', async () => {
        // Delete the custom instance
        await schemaApi.deleteCustomEntity('TEST_ENTITY', createdCustomInstanceId);

        // Verify the custom instance was deleted by expecting an error when trying to get it
        await expect(schemaApi.getCustomEntity('TEST_ENTITY', createdCustomInstanceId)).rejects.toThrow();
      }, 10000);
    });
  });
});
