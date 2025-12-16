import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type EmporixApiClient from '../../common/impl/EmporixApiInvoker';
import type { EmporixConfig } from '../../config';
import {
  EmporixApprovalCreateRequest,
  EmporixApprovalId,
  EmporixApprovalPermittedRequest,
  EmporixApprovalPermittedResponse,
  EmporixApprovalResponse,
  EmporixApprovalSearchUsersRequest,
  EmporixApprovalUpdateRequest,
  EmporixApprovalUser,
} from '../../model/approval';
import { EmporixApprovalApi as IEmporixApprovalApi } from '../EmporixApprovalApi';

@injectable('EmporixApprovalApi', 'Singleton')
class EmporixApprovalApi implements IEmporixApprovalApi {
  constructor(
    @inject('EmporixApiInvoker') protected apiClient: EmporixApiClient,
    @inject('EmporixConfig') protected config: EmporixConfig,
  ) {
    this.apiClient = apiClient;
    this.config = config;
  }

  async createApproval(approval: EmporixApprovalCreateRequest): Promise<EmporixApprovalId> {
    const response = await this.apiClient.authenticatedFetch(
      `/approval/${this.config.tenant}/approvals`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(approval),
      },
      'session',
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to create approval: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async getApprovals(
    pageNumber: number = 1,
    pageSize: number = 60,
    sort?: string,
    query?: string,
  ): Promise<EmporixApprovalResponse[]> {
    let url = `/approval/${this.config.tenant}/approvals?pageNumber=${pageNumber}&pageSize=${pageSize}`;

    if (sort) {
      url += `&sort=${encodeURIComponent(sort)}`;
    }

    if (query) {
      url += `&q=${encodeURIComponent(query)}`;
    }

    const response = await this.apiClient.authenticatedFetch(
      url,
      {
        method: 'GET',
        headers: {
          'X-Total-Count': 'true',
        },
      },
      'session',
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to get approvals: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async getApproval(approvalId: string): Promise<EmporixApprovalResponse | null> {
    const response = await this.apiClient.authenticatedFetch(
      `/approval/${this.config.tenant}/approvals/${approvalId}`,
      { method: 'GET' },
      'session',
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      const error = await response.json();
      throw new Error(`Failed to get approval: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async updateApproval(approvalId: string, updateOperations: EmporixApprovalUpdateRequest[]): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/approval/${this.config.tenant}/approvals/${approvalId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateOperations),
      },
      'session',
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to update approval: ${JSON.stringify(error)}`);
    }
  }

  async deleteApproval(approvalId: string): Promise<void> {
    const response = await this.apiClient.authenticatedFetch(
      `/approval/${this.config.tenant}/approvals/${approvalId}`,
      { method: 'DELETE' },
      'session',
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to delete approval: ${JSON.stringify(error)}`);
    }
  }

  async checkApprovalPermitted(request: EmporixApprovalPermittedRequest): Promise<EmporixApprovalPermittedResponse> {
    const response = await this.apiClient.authenticatedFetch(
      `/approval/${this.config.tenant}/approval/permitted`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      'session',
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to check approval permission: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }

  async searchApprovalUsers(request: EmporixApprovalSearchUsersRequest): Promise<EmporixApprovalUser[]> {
    const response = await this.apiClient.authenticatedFetch(
      `/approval/${this.config.tenant}/search/users`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      },
      'session',
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Failed to search approval users: ${JSON.stringify(error)}`);
    }

    return await response.json();
  }
}

export default EmporixApprovalApi;
