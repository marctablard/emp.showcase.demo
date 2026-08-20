import { EmporixPaginatedResponse, EmporixSearchParams } from '../model';
import {
  AccessControlQueryParams,
  EmporixAccessControl,
  EmporixGroup,
  EmporixGroupAssignmentRequest,
  EmporixIamGroupUserAssignment,
  EmporixIamUser,
  EmporixPermission,
  EmporixResource,
  EmporixRole,
  GroupAssignmentQueryParams,
  IamQueryParams,
} from '../model/iam';

/**
 * Interface for the Emporix IAM API
 * Provides access to Identity and Access Management functionality
 */
export interface EmporixIamApi {
  /**
   * List CUSTOMER users with expanded group assignments.
   * Uses the service token required by `iam.user_read`; a customer session would only list itself.
   */
  getUsers(pageNumber?: number, pageSize?: number): Promise<{ items: EmporixIamUser[]; totalCount?: number }>;

  /**
   * Get all access controls for the tenant
   * @param params Query parameters for filtering
   * @returns List of access controls
   */
  getAccessControls(
    params: EmporixSearchParams<{ roleId: string; resourceId: string }>,
  ): Promise<EmporixPaginatedResponse<EmporixAccessControl>>;

  /**
   * Get an access control by ID
   * @param id Access control ID
   * @param expand Optional fields to expand
   * @returns Access control
   */
  getAccessControlById(id: string, expand?: string[]): Promise<EmporixAccessControl>;

  /**
   * Get all roles for the tenant
   * @param params Query parameters for filtering
   * @returns List of roles
   */
  getRoles(params?: EmporixSearchParams<EmporixRole>): Promise<EmporixPaginatedResponse<EmporixRole>>;

  /**
   * Get a role by ID
   * @param id Role ID
   * @param expand Optional fields to expand
   * @returns Role
   */
  getRoleById(id: string, expand?: string[]): Promise<EmporixRole>;

  /**
   * Get all groups for the tenant
   * @param params Query parameters for filtering
   * @param tokenType Auth token type. Defaults to `'service'` so existing callers
   *   (including `CustomerService.getCustomer`) are unchanged.
   * @returns List of groups
   */
  getGroups(params?: EmporixSearchParams<EmporixGroup>, tokenType?: 'service' | 'session'): Promise<EmporixGroup[]>;

  /**
   * Get a group by ID
   * @param id Group ID
   * @returns Group
   */
  getGroupById(id: string): Promise<EmporixGroup>;

  /**
   * Create a new group
   * @param group Group to create
   * @returns Created group
   */
  createGroup(group: EmporixGroup): Promise<EmporixGroup>;

  /**
   * Update a group
   * @param id Group ID
   * @param group Updated group data
   */
  updateGroup(id: string, group: EmporixGroup): Promise<void>;

  /**
   * Delete a group
   * @param id Group ID
   */
  deleteGroup(id: string): Promise<void>;

  /**
   * Adds a User to a group
   * @param groupId
   * @param groupAssignment
   * @param tokenType Auth token type. Defaults to `'service'`.
   */
  addUserToGroup(
    groupId: string,
    groupAssignment: EmporixGroupAssignmentRequest,
    tokenType?: 'service' | 'session',
  ): Promise<{ id: string }>;

  /**
   * Removes a user from a group (`DELETE /iam/{tenant}/groups/{groupId}/users/{userId}`).
   * @param groupId Group ID
   * @param userId User ID
   * @param tokenType Auth token type. Defaults to `'service'`.
   */
  removeUserFromGroup(groupId: string, userId: string, tokenType?: 'service' | 'session'): Promise<void>;

  /**
   * Adds a User to a group
   * @param groupId
   * @param groupAssignment
   */
  updateUserInGroup(
    groupId: string,
    groupAssignment: EmporixGroupAssignmentRequest,
  ): Promise<EmporixGroupAssignmentRequest>;

  /**
   * Get the current user's scopes
   * @param userId Optional user ID to get scopes for
   * @returns List of scope strings for the current user
   */
  getUserScopes(userId?: string): Promise<{ userId: string; scopes: string }>;

  /**
   * Get the current user's access controls
   * @param userId Optional user ID to get access controls for
   * @returns List of access controls for the current user
   */
  getUserAccessControls(userId?: string): Promise<EmporixAccessControl[]>;

  /**
   * Get the user's groups
   * @param userId User ID to get groups for
   * @param searchParams Optional search parameters for filtering
   * @param tokenType Auth token type. Defaults to `'service'` — do not globally flip this;
   *   `CustomerService.getCustomer()` depends on the service-token default.
   * @returns List of groups for the user
   */
  getUserGroups(
    userId: string,
    searchParams?: EmporixSearchParams<EmporixGroup>,
    tokenType?: 'service' | 'session',
  ): Promise<EmporixPaginatedResponse<EmporixGroup>>;

  /**
   * Lists user assignments for a single IAM group.
   * Wraps GET /iam/{tenant}/groups/{groupId}/users.
   * Uses only pageNumber/pageSize query params; no q filter is supported.
   */
  getGroupUsers(
    groupId: string,
    searchParams?: EmporixSearchParams<EmporixIamGroupUserAssignment>,
    tokenType?: 'service' | 'session',
  ): Promise<EmporixPaginatedResponse<EmporixIamGroupUserAssignment>>;
}
