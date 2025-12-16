import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import { EmporixBulkResponseItem, EmporixCustomEntity, EmporixPatchOperation, EmporixSchema } from '../../model/schema';
import type { EmporixSchemaApi as IEmporixSchemaApi } from '../EmporixSchemaApi';

@injectable('EmporixSchemaApi', 'Singleton')
class EmporixSchemaApi implements IEmporixSchemaApi {
  protected apiClient: EmporixApiClient;
  protected config: EmporixConfig;

  constructor(
    @inject('EmporixApiInvoker') apiClient: EmporixApiClient,
    @inject('EmporixConfig') config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async createCustomEntity(type: string, customEntity: EmporixCustomEntity): Promise<string> {
    const mixins = customEntity.mixins;
    if (mixins) {
      for (const mixinKey of Object.keys(mixins)) {
        try {
          const schema = await this.getSchema(mixinKey);
          if (!schema.metadata.url) {
            throw new Error(`Schema for mixin ${mixinKey} not found`);
          }
          if (!customEntity.metadata) {
            customEntity.metadata = {};
          }
          if (!customEntity.metadata.mixins) {
            customEntity.metadata.mixins = {};
          }
          customEntity.metadata.mixins[mixinKey] = schema.metadata.url;

          // Schema validation could be added here if needed
        } catch (error) {
          console.warn(`Schema for mixin ${mixinKey} not found:`, error);
          // Continue with other mixins even if one fails
        }
      }
    }
    const response = await this.apiClient.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${type}/instances`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(customEntity),
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create custom instance: ${response.statusText} ${errorDetails}`);
    }

    const createdInstance: { id: string } = await response.json();
    return createdInstance.id;
  }

  async getCustomEntities(
    type: string,
    searchParams: EmporixSearchParams<EmporixCustomEntity>,
  ): Promise<EmporixPaginatedResponse<EmporixCustomEntity>> {
    const { body, query } = buildSearchQuery(searchParams);

    const urlQuery = query ? `?${query}&q=${body}` : `?q=${body}`;
    const url = `/schema/${this.config.tenant}/custom-entities/${type}/instances${urlQuery}`;

    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, 'service');

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get custom instances: ${response.statusText} ${errorDetails}`);
    }

    return buildPaginatedResponse(searchParams, response);
  }

  async getCustomEntity(type: string, instanceId: string): Promise<EmporixCustomEntity | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${type}/instances/${instanceId}`,
      { method: 'GET' },
      'service',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const errorDetails = await response.text();
      throw new Error(`Failed to get custom instance: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async updateCustomEntity(type: string, instanceId: string, customEntity: EmporixCustomEntity): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${type}/instances/${instanceId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(customEntity),
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update custom instance: ${response.statusText} ${errorDetails}`);
    }
  }

  async deleteCustomEntity(type: string, instanceId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${type}/instances/${instanceId}`,
      { method: 'DELETE' },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete custom instance: ${response.statusText} ${errorDetails}`);
    }
  }

  async patchCustomEntity(type: string, instanceId: string, operations: EmporixPatchOperation[]): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${type}/instances/${instanceId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json-patch+json',
          Accept: 'application/json',
        },
        body: JSON.stringify(operations),
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to patch custom instance: ${response.statusText} ${errorDetails}`);
    }
  }

  async searchCustomEntities(
    type: string,
    searchParams: EmporixSearchParams<EmporixCustomEntity>,
  ): Promise<EmporixPaginatedResponse<EmporixCustomEntity>> {
    const { body, query } = buildSearchQuery(searchParams);

    const url = `/schema/${this.config.tenant}/custom-entities/${type}/instances/search${query ? `?${query}` : ''}`;

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'X-Total-Count': 'true',
        },
        body: JSON.stringify({ q: body }),
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to search custom instances: ${response.statusText} ${errorDetails}`);
    }
    return buildPaginatedResponse(searchParams, response);
  }

  async createCustomEntitiesBulk(type: string, entities: EmporixCustomEntity[]): Promise<EmporixBulkResponseItem[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${type}/instances/bulk`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(entities),
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create custom instances in bulk: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async updateCustomEntitiesBulk(type: string, entities: EmporixCustomEntity[]): Promise<EmporixBulkResponseItem[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${type}/instances/bulk`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(entities),
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update custom instances in bulk: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async deleteCustomEntitiesBulk(type: string, instanceIds: string[]): Promise<EmporixBulkResponseItem[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/schema/${this.config.tenant}/custom-entities/${type}/instances/bulk`,
      {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(instanceIds),
      },
      'service',
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete custom instances in bulk: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  /**
   * Get schema by ID
   * @param schemaId Schema ID
   * @param version Optional schema version
   * @returns Promise with the schema details
   */
  async getSchema(schemaId: string, version?: number): Promise<EmporixSchema> {
    // Build the URL with optional version parameter
    let url = `/schema/${this.config.tenant}/schemas/${schemaId}`;
    if (version !== undefined) {
      url += `?version=${version}`;
    }

    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, 'service');

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to get schema: ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }
}

export default EmporixSchemaApi;
