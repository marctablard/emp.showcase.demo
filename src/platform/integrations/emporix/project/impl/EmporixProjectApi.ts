import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import type {
  EmporixProjectCreatePayload,
  EmporixProjectEntity,
  EmporixProjectApi as IEmporixProjectApi,
} from '../EmporixProjectApi';

const ENTITY_TYPE = 'PROJECTS';
const MIXIN_SCHEMA_URL = 'https://res.cloudinary.com/saas-ag/raw/upload/schemata2/showcasedemo/projectinfo_v2.json';

@injectable('EmporixProjectApi', 'Singleton')
class EmporixProjectApi implements IEmporixProjectApi {
  constructor(
    @inject('EmporixApiInvoker') private apiClient: EmporixApiClient,
    @inject('EmporixConfig') private config: EmporixConfig,
  ) {}

  async listProjects(q?: string): Promise<EmporixProjectEntity[]> {
    const baseUrl = `schema/${this.config.tenant}/custom-entities/${ENTITY_TYPE}/instances?pageSize=200`;
    const url = q ? `${baseUrl}&q=${encodeURIComponent(q)}` : baseUrl;

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': '*',
        },
        cache: 'no-store',
      },
      'service',
      { scopes: ['schema.custominstance_read'] },
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to list projects: ${response.status} ${response.statusText} ${errorDetails}`);
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  }

  async getProject(id: string): Promise<EmporixProjectEntity | null> {
    const response = await this.apiClient.authenticatedFetch(
      `schema/${this.config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Language': '*',
        },
        cache: 'no-store',
      },
      'service',
      { scopes: ['schema.custominstance_read'] },
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      const errorDetails = await response.text();
      throw new Error(`Failed to get project: ${response.status} ${response.statusText} ${errorDetails}`);
    }

    return await response.json();
  }

  async createProject(payload: EmporixProjectCreatePayload): Promise<string> {
    const body = {
      name: payload.name,
      mixins: payload.mixins,
      metadata: {
        mixins: {
          projectinfo: MIXIN_SCHEMA_URL,
        },
      },
    };

    const response = await this.apiClient.authenticatedFetch(
      `schema/${this.config.tenant}/custom-entities/${ENTITY_TYPE}/instances?validateReferences=false`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
      'service',
      { scopes: ['schema.custominstance_manage'] },
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to create project: ${response.status} ${response.statusText} ${errorDetails}`);
    }

    const result: { id: string } = await response.json();
    return result.id;
  }

  async updateProject(id: string, entity: EmporixProjectEntity): Promise<void> {
    const body = {
      ...entity,
      metadata: {
        ...entity.metadata,
        mixins: {
          projectinfo: MIXIN_SCHEMA_URL,
          ...entity.metadata?.mixins,
        },
      },
    };

    const response = await this.apiClient.authenticatedFetch(
      `schema/${this.config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}?validateReferences=false`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      },
      'service',
      { scopes: ['schema.custominstance_manage'] },
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to update project: ${response.status} ${response.statusText} ${errorDetails}`);
    }
  }

  async deleteProject(id: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `schema/${this.config.tenant}/custom-entities/${ENTITY_TYPE}/instances/${id}`,
      { method: 'DELETE' },
      'service',
      { scopes: ['schema.custominstance_manage'] },
    );

    if (!response.ok) {
      const errorDetails = await response.text();
      throw new Error(`Failed to delete project: ${response.status} ${response.statusText} ${errorDetails}`);
    }
  }
}

export default EmporixProjectApi;
