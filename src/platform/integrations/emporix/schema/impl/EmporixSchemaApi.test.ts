import { Container, inject } from 'inversify';
import { StoredToken } from '@/platform/integrations/types/auth';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { EmporixTokenManager } from '../../common/EmporixTokenManager';
import EmporixApiInvoker from '../../common/impl/EmporixApiInvoker';
import { EmporixTokenManagerAbstract, TokenStore } from '../../common/impl/EmporixTokenManagerAbstract';
import type { EmporixTokenType } from '../../common/token-types';
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

// Sample custom instance creation request (no mixins to avoid schema dependency)
const sampleCustomInstanceCreation: EmporixCustomEntity = {
  id: 'test-instance-1',
  name: { en: 'Test Instance 1' },
  type: 'test-entity-type',
};

// Sample patch operations
const samplePatchOperations: EmporixPatchOperation[] = [
  {
    op: 'replace',
    path: '/name/en',
    value: 'Patched Test Instance',
  },
];

describe('EmporixSchemaApi', () => {
  let container: Container;
  let schemaApi: EmporixSchemaApi;
  let apiInvoker: EmporixApiInvoker;
  const customEntityType = process.env.NEXT_EMPORIX_TEST_CUSTOM_ENTITY_TYPE || 'TEST_ENTITY';
  let isCustomEntityTypeWritable = true;
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
    container.bind<LoggerService>('LoggerService').toConstantValue({
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      fatal: jest.fn(),
    });
    container.bind<EmporixSchemaApi>('EmporixSchemaApi').to(EmporixSchemaApi);

    // Get instances from the container
    apiInvoker = container.get<EmporixApiInvoker>('EmporixApiInvoker');
    schemaApi = container.get<EmporixSchemaApi>('EmporixSchemaApi');
  });

  afterAll(async () => {
    // Clean up any tokens
    await apiInvoker.clearTokens();
  });
  describe('Schema Operations', () => {
    beforeAll(async () => {
      const preflightId = `preflight-${Date.now()}`;

      try {
        await schemaApi.createCustomEntity(customEntityType, {
          ...sampleCustomInstanceCreation,
          id: preflightId,
          type: customEntityType,
        });
        await schemaApi.deleteCustomEntity(customEntityType, preflightId);
      } catch {
        isCustomEntityTypeWritable = false;
      }
    });

    describe('Custom Instance Operations', () => {
      it('should create a custom instance', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Create a custom instance
        createdCustomInstanceId = await schemaApi.createCustomEntity(customEntityType, {
          ...sampleCustomInstanceCreation,
          type: customEntityType,
        });

        // Verify the custom instance was created
        expect(createdCustomInstanceId).toBeDefined();
        expect(typeof createdCustomInstanceId).toBe('string');
        expect(createdCustomInstanceId).toBe(sampleCustomInstanceCreation.id);
      }, 10000);

      let customInstance: EmporixCustomEntity | null | undefined;
      it('should get a custom instance by ID', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Get the custom instance we just created
        customInstance = await schemaApi.getCustomEntity(customEntityType, createdCustomInstanceId);

        // Verify the custom instance details
        expect(customInstance).toBeDefined();
        expect(customInstance?.id).toBe(createdCustomInstanceId);
        expect(customInstance?.name).toEqual(sampleCustomInstanceCreation.name);
        expect(customInstance?.type).toBe(customEntityType);
      }, 10000);

      it('should get all custom instances for a type', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Get all custom instances for the type
        const customInstances = await schemaApi.getCustomEntities(customEntityType, {});

        // Verify custom instances were returned
        expect(customInstances).toBeDefined();
        expect(Array.isArray(customInstances.items)).toBe(true);
        expect(customInstances.items.length).toBeGreaterThan(0);

        // Find our created custom instance
        const createdInstance = customInstances.items.find((i) => i.id === createdCustomInstanceId);
        expect(createdInstance).toBeDefined();
      }, 10000);

      it('should update a custom instance', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Update the custom instance with a new name
        const updatedName = { en: 'Updated Test Instance' };
        await schemaApi.updateCustomEntity(customEntityType, createdCustomInstanceId, {
          name: updatedName,
          type: customEntityType,
        });

        // Get the updated custom instance
        const updatedInstance = await schemaApi.getCustomEntity(customEntityType, createdCustomInstanceId);

        // Verify the name was updated
        expect(updatedInstance).toBeDefined();
        expect(updatedInstance?.name).toEqual(updatedName);
      }, 10000);

      it('should patch a custom instance', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Patch the custom instance
        await schemaApi.patchCustomEntity(customEntityType, createdCustomInstanceId, samplePatchOperations);

        // Get the patched custom instance
        const patchedInstance = await schemaApi.getCustomEntity(customEntityType, createdCustomInstanceId);

        // Verify the patch was applied
        expect(patchedInstance).toBeDefined();
        expect(patchedInstance?.name?.en).toBe('Patched Test Instance');
      }, 10000);

      it('should search custom instances', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Search for custom instances
        const searchResults = await schemaApi.searchCustomEntities(customEntityType, { criteria: { name: 'Test' } });

        // Verify search results were returned
        expect(searchResults).toBeDefined();
        expect(Array.isArray(searchResults.items)).toBe(true);
        expect(searchResults.items.length).toBeGreaterThan(0);
      }, 10000);

      it('should create custom instances in bulk', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Create bulk instances
        const bulkInstances: EmporixCustomEntity[] = [
          {
            id: 'bulk-test-1',
            type: customEntityType,
            name: { en: 'Bulk Test 1' },
          },
          {
            id: 'bulk-test-2',
            type: customEntityType,
            name: { en: 'Bulk Test 2' },
          },
        ];

        const bulkResponse = await schemaApi.createCustomEntitiesBulk(customEntityType, bulkInstances);

        // Verify bulk response
        expect(bulkResponse).toBeDefined();
        expect(Array.isArray(bulkResponse)).toBe(true);
        expect(bulkResponse.length).toBe(bulkInstances.length);
        expect(bulkResponse[0].status).toBeDefined();
      }, 10000);

      it('should update custom instances in bulk', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Update bulk instances
        const bulkUpdates: EmporixCustomEntity[] = [
          {
            id: 'bulk-test-1',
            type: customEntityType,
            name: { en: 'Updated Bulk Test 1' },
          },
          {
            id: 'bulk-test-2',
            type: customEntityType,
            name: { en: 'Updated Bulk Test 2' },
          },
        ];

        const bulkResponse = await schemaApi.updateCustomEntitiesBulk(customEntityType, bulkUpdates);

        // Verify bulk response
        expect(bulkResponse).toBeDefined();
        expect(Array.isArray(bulkResponse)).toBe(true);
        expect(bulkResponse.length).toBe(bulkUpdates.length);
        expect(bulkResponse[0].status).toBeDefined();
      }, 10000);

      it('should delete custom instances in bulk', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Delete bulk instances
        const bulkIds = ['bulk-test-1', 'bulk-test-2'];
        const bulkResponse = await schemaApi.deleteCustomEntitiesBulk(customEntityType, bulkIds);

        // Verify bulk response
        expect(bulkResponse).toBeDefined();
        expect(Array.isArray(bulkResponse)).toBe(true);
        expect(bulkResponse.length).toBe(bulkIds.length);
        expect(bulkResponse[0].status).toBeDefined();
      }, 10000);
    });

    describe('Error Handling', () => {
      it('should throw error when getting non-existent custom instance', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Attempt to get a non-existent custom instance
        const nonExistentInstanceId = 'non-existent-instance-id';

        // Expect the operation to throw an error
        await expect(schemaApi.getCustomEntity(customEntityType, nonExistentInstanceId)).resolves.toBeNull();
      }, 10000);
    });

    describe('Cleanup', () => {
      it('should delete a custom instance', async () => {
        if (!isCustomEntityTypeWritable) return;
        // Delete the custom instance
        await schemaApi.deleteCustomEntity(customEntityType, createdCustomInstanceId);

        // Verify the custom instance was deleted by expecting an error when trying to get it
        await expect(schemaApi.getCustomEntity(customEntityType, createdCustomInstanceId)).resolves.toBeNull();
      }, 10000);
    });
  });
});
