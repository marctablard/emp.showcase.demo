import {
  EmporixApprovalCreateRequest,
  EmporixApprovalId,
  EmporixApprovalPermittedRequest,
  EmporixApprovalPermittedResponse,
  EmporixApprovalResponse,
  EmporixApprovalSearchUsersRequest,
  EmporixApprovalUpdateRequest,
  EmporixApprovalUser,
} from '../model/approval';

/**
 * Interface for the Emporix Approval API
 */
export interface EmporixApprovalApi {
  /**
   * Create a new approval
   * @param approval The approval to create
   * @returns Promise with the created approval ID
   */
  createApproval(approval: EmporixApprovalCreateRequest): Promise<EmporixApprovalId>;

  /**
   * Get all approvals for the current user
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size (default: 60)
   * @param sort Optional sort parameter
   * @param query Optional query parameter for filtering
   * @returns Promise with the approval items and, when requested via `X-Total-Count`, the total count
   */
  getApprovals(
    pageNumber?: number,
    pageSize?: number,
    sort?: string,
    query?: string,
  ): Promise<{ items: EmporixApprovalResponse[]; totalCount?: number }>;

  /**
   * Get a specific approval by ID
   * @param approvalId The ID of the approval to retrieve
   * @returns Promise with the approval or null if not found
   */
  getApproval(approvalId: string): Promise<EmporixApprovalResponse | null>;

  /**
   * Update an approval
   * @param approvalId The ID of the approval to update
   * @param updateOperations Array of update operations
   * @returns Promise that resolves when the update is complete
   */
  updateApproval(approvalId: string, updateOperations: EmporixApprovalUpdateRequest[]): Promise<void>;

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
  checkApprovalPermitted(request: EmporixApprovalPermittedRequest): Promise<EmporixApprovalPermittedResponse>;

  /**
   * Search for users who can be assigned as approvers
   * @param request The search request
   * @returns Promise with array of users
   */
  searchApprovalUsers(request: EmporixApprovalSearchUsersRequest): Promise<EmporixApprovalUser[]>;
}
