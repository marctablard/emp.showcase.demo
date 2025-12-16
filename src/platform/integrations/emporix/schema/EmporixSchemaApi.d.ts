import { EmporixPaginatedResponse, EmporixSearchParams } from '../model/common';
import { BulkResponse, EmporixCustomEntity, EmporixPatchOperation, EmporixSchema } from '../model/schema';

/**
 * Interface for Schema API operations
 */
export interface EmporixSchemaApi {
  /**
   * Create a custom instance
   * @param type Custom schema type
   * @param customInstance Custom instance creation request
   * @returns Promise with the created custom instance ID
   */
  createCustomEntity(type: string, customEntity: EmporixCustomEntity): Promise<string>;

  /**
   * Get all custom instances for a type
   * @param type Custom schema type
   * @param searchParams Search parameters
   * @returns Promise with array of custom instances
   */
  getCustomEntities(
    type: string,
    searchParams: EmporixSearchParams<any>,
  ): Promise<EmporixPaginatedResponse<EmporixCustomEntity>>;

  /**
   * Get custom instance by ID
   * @param type Custom schema type
   * @param instanceId Custom instance ID
   * @returns Promise with the custom instance details
   */
  getCustomEntity(type: string, instanceId: string): Promise<EmporixCustomEntity | null>;

  /**
   * Update custom instance
   * @param type Custom schema type
   * @param instanceId Custom instance ID
   * @param customEntity Custom entity update request
   * @returns Promise resolving when update is complete
   */
  updateCustomEntity(type: string, instanceId: string, customEntity: EmporixCustomEntity): Promise<void>;

  /**
   * Delete custom instance
   * @param type Custom schema type
   * @param instanceId Custom instance ID
   * @returns Promise resolving when deletion is complete
   */
  deleteCustomEntity(type: string, instanceId: string): Promise<void>;

  /**
   * Patch custom instance
   * @param type Custom schema type
   * @param instanceId Custom instance ID
   * @param operations Array of patch operations
   * @returns Promise resolving when patch is complete
   */
  patchCustomEntity(type: string, instanceId: string, operations: EmporixPatchOperation[]): Promise<void>;

  /**
   * Search custom instances
   * @param type Custom schema type
   * @param searchParams Search parameters
   * @returns Promise with array of matching custom instances
   */
  searchCustomEntities(
    type: string,
    searchParams: EmporixSearchParams<any>,
  ): Promise<EmporixPaginatedResponse<EmporixCustomEntity>>;

  /**
   * Create custom entities in bulk
   * @param type Custom schema type
   * @param entities Array of custom entity creation requests
   * @returns Promise with bulk operation response
   */
  createCustomEntitiesBulk(type: string, entities: EmporixCustomEntity[]): Promise<BulkResponse>;

  /**
   * Update custom entities in bulk
   * @param type Custom schema type
   * @param entities Array of custom entity update requests with IDs
   * @returns Promise with bulk operation response
   */
  updateCustomEntitiesBulk(type: string, entities: (EmporixCustomEntity & { id: string })[]): Promise<BulkResponse>;

  /**
   * Delete custom entities in bulk
   * @param type Custom schema type
   * @param instanceIds Array of custom instance IDs to delete
   * @returns Promise with bulk operation response
   */
  deleteCustomEntitiesBulk(type: string, instanceIds: string[]): Promise<BulkResponse>;

  /**
   * Get schema by ID
   * @param schemaId Schema ID
   * @param version Optional schema version
   * @returns Promise with the schema details
   */
  getSchema(schemaId: string, version?: number): Promise<EmporixSchema>;
}
