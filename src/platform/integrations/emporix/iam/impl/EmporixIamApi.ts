import { inject } from 'inversify';
import 'server-only';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import { buildPaginatedResponse, buildSearchQuery } from '../../common/util/common';
import type { EmporixConfig } from '../../config';
import type { EmporixPaginatedResponse, EmporixSearchParams } from '../../model';
import type { EmporixAccessControl, EmporixGroup, EmporixGroupAssignmentRequest, EmporixRole } from '../../model/iam';
import type { EmporixIamApi as IEmporixIamApi } from '../EmporixIamApi';

/**
 * Implementation of the Emporix IAM API
 * Provides access to Identity and Access Management functionality
 */
@injectable('EmporixIamApi', 'Singleton')
class EmporixIamApi implements IEmporixIamApi {
  constructor(
    @inject('EmporixApiInvoker') protected readonly apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected readonly config: EmporixConfig,
  ) {}

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
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve access controls: ${response.statusText}`);
    }

    return buildPaginatedResponse(params, response);
  }

  async getAccessControlById(id: string, expand?: string[]): Promise<EmporixAccessControl> {
    const queryString = expand && expand.length > 0 ? `?expand=${expand.join(',')}` : '';
    const url = `/iam/${this.config.tenant}/access-controls/${id}${queryString}`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, 'service');

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
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve roles: ${response.statusText}`);
    }
    return buildPaginatedResponse(params, response);
  }

  async getRoleById(id: string, expand?: string[]): Promise<EmporixRole> {
    const queryString = expand && expand.length > 0 ? `?expand=${expand.join(',')}` : '';
    const url = `/iam/${this.config.tenant}/roles/${id}${queryString}`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, 'service');

    if (!response.ok) {
      throw new Error(`Failed to retrieve role with ID ${id}: ${response.statusText}`);
    }

    return response.json();
  }

  async getGroups(params: EmporixSearchParams<EmporixGroup>): Promise<EmporixGroup[]> {
    const { query } = buildSearchQuery(params);
    const url = `/iam/${this.config.tenant}/groups?${query}`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, 'service');

    if (!response.ok) {
      throw new Error(`Failed to retrieve groups: ${response.statusText}`);
    }

    return response.json();
  }

  async getGroupById(id: string): Promise<EmporixGroup> {
    const url = `/iam/${this.config.tenant}/groups/${id}`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, 'service');

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
    );

    if (!response.ok) {
      throw new Error(`Failed to update group with ID ${id}: ${response.statusText}`);
    }
  }

  async deleteGroup(id: string): Promise<void> {
    const url = `/iam/${this.config.tenant}/groups/${id}`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'DELETE' }, 'service');

    if (!response.ok) {
      throw new Error(`Failed to delete group with ID ${id}: ${response.statusText}`);
    }
  }

  async addUserToGroup(groupId: string, groupAssignment: EmporixGroupAssignmentRequest): Promise<{ id: string }> {
    const url = `/iam/${this.config.tenant}/groups/${groupId}/users`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(groupAssignment),
      },
      'service',
    );

    if (!response.ok) {
      throw new Error(`Failed to create group assignment: ${response.statusText}`);
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
    );

    if (!response.ok) {
      throw new Error(`Failed to create group assignment: ${response.statusText}`);
    }

    return response.json();
  }

  async removeAllUsersFromGroup(groupId: string): Promise<void> {
    const url = `/iam/${this.config.tenant}/groups/${groupId}/users`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'DELETE' }, 'service');

    if (!response.ok) {
      throw new Error(`Failed to delete all group assignments with ID ${groupId}: ${response.statusText}`);
    }
  }

  async removeUserFromGroup(groupId: string, userId: string): Promise<void> {
    const url = `/iam/${this.config.tenant}/groups/${groupId}/users/${userId}`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'DELETE' }, 'service');

    if (!response.ok) {
      throw new Error(
        `Failed to delete user assignment with user ${userId} and group ${groupId}: ${response.statusText}`,
      );
    }
  }

  async getUserScopes(userId?: string): Promise<{ userId: string; scopes: string }> {
    const url = `/iam/${this.config.tenant}/users/${userId || 'me'}/scopes`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, userId ? 'service' : 'session');

    if (!response.ok) {
      throw new Error(`Failed to retrieve user scopes: ${response.statusText}`);
    }

    return response.json();
  }

  async getUserGroups(
    userId: string,
    searchParams: EmporixSearchParams<EmporixGroup> = {},
  ): Promise<EmporixPaginatedResponse<EmporixGroup>> {
    const { query } = buildSearchQuery(searchParams);
    const url = `/iam/${this.config.tenant}/users/${userId}/groups?${query}`;
    const response = await this.apiClient.authenticatedFetch(
      url,
      { method: 'GET', headers: { 'X-Total-Count': 'true' } },
      'service',
    );

    if (!response.ok) {
      throw new Error(`Failed to retrieve user groups: ${response.statusText}`);
    }

    return buildPaginatedResponse(searchParams, response);
  }

  async getUserAccessControls(userId?: string): Promise<EmporixAccessControl[]> {
    const url = `/iam/${this.config.tenant}/users/${userId || 'me'}/access-controls`;
    const response = await this.apiClient.authenticatedFetch(url, { method: 'GET' }, userId ? 'service' : 'session');

    if (!response.ok) {
      throw new Error(`Failed to retrieve user access controls: ${response.statusText}`);
    }

    return response.json();
  }
}

export default EmporixIamApi;
