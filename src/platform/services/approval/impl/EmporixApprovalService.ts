import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { EmporixApprovalApi } from '@/platform/integrations/emporix/approval/EmporixApprovalApi';
import type { EmporixIamApi } from '@/platform/integrations/emporix/iam/EmporixIamApi';
import type {
  EmporixApprovalSearchUsersRequest,
  EmporixApprovalUpdateRequest,
} from '@/platform/integrations/emporix/model/approval';
import type {
  Approval,
  ApprovalCreateRequest,
  ApprovalId,
  ApprovalPermittedRequest,
  ApprovalPermittedResponse,
  ApprovalStatus,
  ApprovalUser,
} from '@/platform/services/model/approval';
import type { EmporixApprovalMapper } from '@/platform/services/model/approval/impl/EmporixApprovalMapper';
import type { CustomerService } from '../../customer/CustomerService';
import type { ApprovalService } from '../ApprovalService';

/**
 * Implementation of ApprovalService interface for Emporix approval operations.
 */
@injectable('ApprovalService', 'Singleton')
export class EmporixApprovalService implements ApprovalService {
  constructor(
    @inject('EmporixIamApi') private iamApi: EmporixIamApi,
    @inject('EmporixApprovalApi') private approvalApi: EmporixApprovalApi,
    @inject('EmporixApprovalMapper') private approvalMapper: EmporixApprovalMapper,
    @inject('CustomerService') private customerService: CustomerService,
  ) {}

  /**
   * Create a new approval
   * @param approval The approval to create
   * @returns Promise with the created approval ID
   */
  async createApproval(approval: ApprovalCreateRequest): Promise<ApprovalId> {
    // Map service model to integration model
    const emporixApproval = this.approvalMapper.mapCreateRequestToSource(approval);

    // Call the API
    return await this.approvalApi.createApproval(emporixApproval);
  }

  /**
   * Get all approvals for the current user
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size (default: 60)
   * @param sort Optional sort parameter
   * @param query Optional query parameter for filtering
   * @returns Promise with array of approvals
   */
  async getApprovals(
    pageNumber: number = 1,
    pageSize: number = 60,
    sort?: string,
    query?: string,
  ): Promise<Approval[]> {
    // Call the API
    const emporixApprovals = await this.approvalApi.getApprovals(pageNumber, pageSize, sort, query);

    // Map each approval to service model
    return emporixApprovals.map((approval) => this.approvalMapper.mapToService(approval));
  }

  /**
   * Get a specific approval by ID
   * @param approvalId The ID of the approval to retrieve
   * @returns Promise with the approval or undefined if not found
   */
  async getApproval(approvalId: string): Promise<Approval | undefined> {
    // Call the API
    const emporixApproval = await this.approvalApi.getApproval(approvalId);

    // If not found, return undefined
    if (!emporixApproval) {
      return undefined;
    }

    // Map to service model
    return this.approvalMapper.mapToService(emporixApproval);
  }

  /**
   * Update an approval's status
   * @param approvalId The ID of the approval to update
   * @param status The new status to set
   * @returns Promise that resolves when the update is complete
   */
  async updateApprovalStatus(approvalId: string, status: ApprovalStatus): Promise<void> {
    const updateOperation: EmporixApprovalUpdateRequest = {
      op: 'replace',
      path: '/status',
      value: status,
    };

    await this.approvalApi.updateApproval(approvalId, [updateOperation]);
  }

  /**
   * Add or update an approver comment
   * @param approvalId The ID of the approval
   * @param comment The comment to add or update
   * @returns Promise that resolves when the update is complete
   */
  async updateApproverComment(approvalId: string, comment: string): Promise<void> {
    const updateOperation: EmporixApprovalUpdateRequest = {
      op: 'add',
      path: '/approverComment',
      value: comment,
    };

    await this.approvalApi.updateApproval(approvalId, [updateOperation]);
  }

  /**
   * Update a requestor comment
   * @param approvalId The ID of the approval
   * @param comment The comment to update
   * @returns Promise that resolves when the update is complete
   */
  async updateRequestorComment(approvalId: string, comment: string): Promise<void> {
    const updateOperation: EmporixApprovalUpdateRequest = {
      op: 'add',
      path: '/comment',
      value: comment,
    };

    await this.approvalApi.updateApproval(approvalId, [updateOperation]);
  }

  /**
   * Delete an approval
   * @param approvalId The ID of the approval to delete
   * @returns Promise that resolves when the deletion is complete
   */
  async deleteApproval(approvalId: string): Promise<void> {
    await this.approvalApi.deleteApproval(approvalId);
  }

  /**
   * Check if an action is permitted for a resource
   * @param request The permission check request
   * @returns Promise with the permission check result
   */
  async checkApprovalPermitted(request: ApprovalPermittedRequest): Promise<ApprovalPermittedResponse> {
    return await this.approvalApi.checkApprovalPermitted(request);
  }

  /**
   * Search for users who can be assigned as approvers
   * @param resourceType The type of resource
   * @param resourceId The ID of the resource
   * @param action The action to check
   * @returns Promise with array of users
   */
  async searchApprovalUsers(resourceType: string, resourceId: string, action: string): Promise<ApprovalUser[]> {
    const request: EmporixApprovalSearchUsersRequest = {
      resourceType: resourceType as any,
      resourceId,
      action: action as any,
    };

    const emporixUsers = await this.approvalApi.searchApprovalUsers(request);

    // Map to service model and add full name
    return emporixUsers.map((user) => ({
      userId: user.userId,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
    }));
  }

  /**
   * Requires Approval
   * @param cartId The ID of the cart
   * @returns Promise with the requires approval result
   */
  async requiresApproval(cartId: string): Promise<boolean> {
    const customer = await this.customerService.getCustomer();
    if (!customer || customer.businessModel == 'B2C') {
      // Guests and B2C Customers don't require Approval.
      return false;
    }

    const permitted = await this.approvalApi.checkApprovalPermitted({
      resourceType: 'CART',
      resourceId: cartId,
      action: 'CHECKOUT',
    });
    return !permitted.permitted;
  }
}
export default EmporixApprovalService;
