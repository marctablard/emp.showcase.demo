import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import { createEmporixApiError } from '@/platform/integrations/emporix/common/EmporixApiError';
import { createFetchMetricsParams } from '@/platform/integrations/emporix/metrics-utils';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import type {
  EmporixAccessControl,
  EmporixGroup,
  EmporixGroupAssignmentRequest,
  EmporixIamGroupUserAssignment,
  EmporixIamUser,
  EmporixRole,
} from '../../model/iam';
import type { EmporixIamApi as IEmporixIamApi } from '../EmporixIamApi';

const createIamMetrics = (route: string) => createFetchMetricsParams('iam', route);

async function readResponseBody(response: Response): Promise<unknown> {
  const rawBody = await response.clone().text();
  if (!rawBody) {
    return '';
  }

  try {
    return JSON.parse(rawBody) as unknown;
  } catch {
    return rawBody;
  }
}

/**
 * Implementation of the Emporix IAM API
 * Provides access to Identity and Access Management functionality
 */
@injectable('EmporixIamApi', 'Singleton')
class EmporixIamApi implements IEmporixIamApi {
  constructor(
    @inject('EmporixApiInvoker') protected readonly apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected readonly config: EmporixConfig,
    @inject('LoggerService') protected readonly logger: LoggerService,
  ) {}

  async getUsers(
    pageNumber: number = 1,
    pageSize: number = 60,
  ): Promise<{ items: EmporixIamUser[]; totalCount?: number }> {
    const query = new URLSearchParams({
      userType: 'CUSTOMER',
      expand: 'groups',
      pageNumber: String(pageNumber),
      pageSize: String(pageSize),
    });
    const response = await this.apiClient.authenticatedFetch(
      `/iam/${this.config.tenant}/users?${query.toString()}`,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/users'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve users: ${response.statusText}`);
    }

    const items: unknown = await response.json();
    if (!Array.isArray(items)) {
      throw new Error('Failed to retrieve users: response body is not an array');
    }

    const rawTotalCount = response.headers.get('x-total-count');
    const parsedTotalCount = rawTotalCount === null ? Number.NaN : Number.parseInt(rawTotalCount, 10);
    return {
      items: items as EmporixIamUser[],
      ...(Number.isFinite(parsedTotalCount) ? { totalCount: parsedTotalCount } : {}),
    };
  }

  async getAccessControls(
    params: EmporixSearchParams<{
      roleId: string;
      resourceId: string;
    }>,
  ): Promise<EmporixPaginatedResponse<EmporixAccessControl>> {
    const { query } = buildSearchQuery(params, true);

    const url = `/iam/${this.config.tenant}/access-controls?${query}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/access-controls'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve access controls: ${response.statusText}`);
    }

    return buildPaginatedResponse(params, response);
  }

  async getAccessControlById(id: string, expand?: string[]): Promise<EmporixAccessControl> {
    const queryString = expand && expand.length > 0 ? `?expand=${expand.join(',')}` : '';
    const url = `/iam/${this.config.tenant}/access-controls/${id}${queryString}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET' },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/access-controls/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve access control with ID ${id}: ${response.statusText}`);
    }

    return response.json();
  }

  async getRoles(params: EmporixSearchParams<EmporixRole> = {}): Promise<EmporixPaginatedResponse<EmporixRole>> {
    const { query } = buildSearchQuery(params);

    const url = `/iam/${this.config.tenant}/roles${query}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/roles'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve roles: ${response.statusText}`);
    }
    return buildPaginatedResponse(params, response);
  }

  async getRoleById(id: string, expand?: string[]): Promise<EmporixRole> {
    const queryString = expand && expand.length > 0 ? `?expand=${expand.join(',')}` : '';
    const url = `/iam/${this.config.tenant}/roles/${id}${queryString}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET' },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/roles/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve role with ID ${id}: ${response.statusText}`);
    }

    return response.json();
  }

  async getGroups(
    params: EmporixSearchParams<EmporixGroup> = {},
    tokenType: 'service' | 'session' = 'service',
  ): Promise<EmporixGroup[]> {
    const { body, query } = buildSearchQuery(params, true);
    const queryParams = new URLSearchParams(query);
    if (body) {
      queryParams.set('q', body);
    }
    const url = `/iam/${this.config.tenant}/groups?${queryParams.toString()}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET' },
      tokenType,
      undefined,
      createIamMetrics('/iam/{tenant}/groups'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve groups: ${response.statusText}`);
    }

    return response.json();
  }

  async getGroupById(id: string): Promise<EmporixGroup> {
    const url = `/iam/${this.config.tenant}/groups/${id}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET' },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/groups/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve group with ID ${id}: ${response.statusText}`);
    }

    return response.json();
  }

  async createGroup(group: EmporixGroup): Promise<EmporixGroup> {
    const url = `/iam/${this.config.tenant}/groups`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(group),
      },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/groups'),
    );

    if (!response.ok) {
      throw new Error(`Failed to create group: ${response.statusText}`);
    }

    return response.json();
  }

  async updateGroup(id: string, group: EmporixGroup): Promise<void> {
    const url = `/iam/${this.config.tenant}/groups/${id}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(group),
      },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/groups/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to update group with ID ${id}: ${response.statusText}`);
    }
  }

  async deleteGroup(id: string): Promise<void> {
    const url = `/iam/${this.config.tenant}/groups/${id}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'DELETE' },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/groups/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to delete group with ID ${id}: ${response.statusText}`);
    }
  }

  async addUserToGroup(
    groupId: string,
    groupAssignment: EmporixGroupAssignmentRequest,
    tokenType: 'service' | 'session' = 'service',
  ): Promise<{ id: string }> {
    const url = `/iam/${this.config.tenant}/groups/${groupId}/users`;
    const requestHeaders = { 'Content-Type': 'application/json' };
    const requestBody = { ...groupAssignment, groupId };
    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(groupAssignment),
      },
      tokenType,
      undefined,
      createIamMetrics('/iam/{tenant}/groups/{id}/users'),
    );

    const logContext = {
      operation: 'Add user to group',
      tokenType,
      method: 'POST',
      url,
      requestHeaders,
      requestBody,
      responseStatus: response.status,
      responseBody: await readResponseBody(response),
    };
    if (response.ok) {
      this.logger.info(logContext, 'EXTERNAL Add user to group response');
    } else {
      this.logger.error(logContext, 'EXTERNAL Add user to group response');
    }

    if (!response.ok) {
      throw await createEmporixApiError('Add user to group', response);
    }

    return response.json();
  }

  async updateUserInGroup(
    groupId: string,
    groupAssignment: EmporixGroupAssignmentRequest,
  ): Promise<EmporixGroupAssignmentRequest> {
    const url = `/iam/${this.config.tenant}/groups/${groupId}/users/${groupAssignment.userType}/${groupAssignment.userId}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/groups/{id}/users/{userType}/{id}'),
    );

    if (!response.ok) {
      throw new Error(`Failed to create group assignment: ${response.statusText}`);
    }

    return response.json();
  }

  async removeAllUsersFromGroup(groupId: string): Promise<void> {
    const url = `/iam/${this.config.tenant}/groups/${groupId}/users`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'DELETE' },
      'service',
      undefined,
      createIamMetrics('/iam/{tenant}/groups/{id}/users'),
    );

    if (!response.ok) {
      throw new Error(`Failed to delete all group assignments with ID ${groupId}: ${response.statusText}`);
    }
  }

  async removeUserFromGroup(
    groupId: string,
    userId: string,
    tokenType: 'service' | 'session' = 'service',
  ): Promise<void> {
    const url = `/iam/${this.config.tenant}/groups/${groupId}/users/${userId}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'DELETE' },
      tokenType,
      undefined,
      createIamMetrics('/iam/{tenant}/groups/{id}/users/{id}'),
    );

    if (!response.ok) {
      throw new Error(
        `Failed to delete user assignment with user ${userId} and group ${groupId}: ${response.statusText}`,
      );
    }
  }

  async getUserScopes(userId?: string): Promise<{ userId: string; scopes: string }> {
    const url = `/iam/${this.config.tenant}/users/${userId || 'me'}/scopes`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET' },
      userId ? 'service' : 'session',
      undefined,
      createIamMetrics('/iam/{tenant}/users/{id}/scopes'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve user scopes: ${response.statusText}`);
    }

    return response.json();
  }

  async getUserGroups(
    userId: string,
    searchParams: EmporixSearchParams<EmporixGroup> = {},
    tokenType: 'service' | 'session' = 'service',
  ): Promise<EmporixPaginatedResponse<EmporixGroup>> {
    const { query } = buildSearchQuery(searchParams);
    const url = `/iam/${this.config.tenant}/users/${userId}/groups?${query}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      tokenType,
      undefined,
      createIamMetrics('/iam/{tenant}/users/{id}/groups'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve user groups: ${response.statusText}`);
    }

    return buildPaginatedResponse(searchParams, response);
  }

  async getGroupUsers(
    groupId: string,
    searchParams: EmporixSearchParams<EmporixIamGroupUserAssignment> = {},
    tokenType: 'service' | 'session' = 'service',
  ): Promise<EmporixPaginatedResponse<EmporixIamGroupUserAssignment>> {
    const queryParams = new URLSearchParams();
    if (searchParams.page !== undefined) {
      queryParams.set('pageNumber', String(searchParams.page));
    }
    if (searchParams.size !== undefined) {
      queryParams.set('pageSize', String(searchParams.size));
    }

    const queryString = queryParams.toString();
    const url = `/iam/${this.config.tenant}/groups/${groupId}/users${queryString ? `?${queryString}` : ''}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      tokenType,
      undefined,
      createIamMetrics('/iam/{tenant}/groups/{groupId}/users'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve group users: ${response.statusText}`);
    }

    return buildPaginatedResponse(searchParams, response);
  }

  async getUserAccessControls(userId?: string): Promise<EmporixAccessControl[]> {
    const url = `/iam/${this.config.tenant}/users/${userId || 'me'}/access-controls`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET' },
      userId ? 'service' : 'session',
      undefined,
      createIamMetrics('/iam/{tenant}/users/{id}/access-controls'),
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve user access controls: ${response.statusText}`);
    }

    return response.json();
  }
}

export default EmporixIamApi;
