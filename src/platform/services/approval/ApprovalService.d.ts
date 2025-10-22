import {
  Approval,
  ApprovalCreateRequest,
  ApprovalId,
  ApprovalPermittedRequest,
  ApprovalPermittedResponse,
  ApprovalStatus,
  ApprovalUser,
} from '../model/approval';

/**
 * Interface for approval service.
 * Defines methods for approval operations.
 */
export interface ApprovalService {
  /**
   * Create a new approval
   * @param approval The approval to create
   * @returns Promise with the created approval ID
   */
  createApproval(approval: ApprovalCreateRequest): Promise<ApprovalId>;

  /**
   * Get all approvals for the current user
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size (default: 60)
   * @param sort Optional sort parameter
   * @param query Optional query parameter for filtering
   * @returns Promise with array of approvals
   */
  getApprovals(pageNumber?: number, pageSize?: number, sort?: string, query?: string): Promise<Approval[]>;

  /**
   * Get a specific approval by ID
   * @param approvalId The ID of the approval to retrieve
   * @returns Promise with the approval or undefined if not found
   */
  getApproval(approvalId: string): Promise<Approval | undefined>;

  /**
   * Update an approval's status
   * @param approvalId The ID of the approval to update
   * @param status The new status to set
   * @returns Promise that resolves when the update is complete
   */
  updateApprovalStatus(approvalId: string, status: ApprovalStatus): Promise<void>;

  /**
   * Add or update an approver comment
   * @param approvalId The ID of the approval
   * @param comment The comment to add or update
   * @returns Promise that resolves when the update is complete
   */
  updateApproverComment(approvalId: string, comment: string): Promise<void>;

  /**
   * Update a requestor comment
   * @param approvalId The ID of the approval
   * @param comment The comment to update
   * @returns Promise that resolves when the update is complete
   */
  updateRequestorComment(approvalId: string, comment: string): Promise<void>;

  /**
   * Delete an approval
   * @param approvalId The ID of the approval to delete
   * @returns Promise that resolves when the deletion is complete
   */
  deleteApproval(approvalId: string): Promise<void>;

  /**
   * Check if an action is permitted for a resource
   * @param request The permission check request
   * @returns Promise with the permission check result
   */
  checkApprovalPermitted(request: ApprovalPermittedRequest): Promise<ApprovalPermittedResponse>;

  /**
   * Search for users who can be assigned as approvers
   * @param resourceType The type of resource
   * @param resourceId The ID of the resource
   * @param action The action to check
   * @returns Promise with array of users
   */
  searchApprovalUsers(resourceType: string, resourceId: string, action: string): Promise<ApprovalUser[]>;

  /**
   * Requires Approval
   * @param cartId The ID of the cart
   * @returns Promise with the requires approval result
   */
  requiresApproval(cartId: string): Promise<boolean>;
}
