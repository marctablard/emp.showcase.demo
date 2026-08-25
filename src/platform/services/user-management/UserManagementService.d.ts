import {
  AssignableLegalEntityGroups,
  CompanyUser,
  CompanyUserListResult,
  CreateCompanyUserRequest,
  CreateCompanyUserResult,
  UpdateCompanyUserRequest,
} from '../model/user-management/company-user';

/**
 * Interface for company user administration of the selected legal entity.
 * Defines methods for list, get, invite-create, update, delete, and assignable groups.
 */
export interface UserManagementService {
  /**
   * List users from the complete selected-LE contact-assignment set. IAM groups
   * are optional labels and do not define membership.
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size
   * @param sort Optional raw sort string (e.g. firstName:asc)
   * @param query Optional raw name-search string (tokenized in the service)
   * @returns Promise with the user items and optional total count of the filtered selected-LE set
   */
  listUsers(pageNumber?: number, pageSize?: number, sort?: string, query?: string): Promise<CompanyUserListResult>;

  /**
   * List assignment rows for every legal entity where the current customer is Admin,
   * including the selected legal entity and the current user. One row per
   * `(customer, legalEntity)` — not cross-LE deduplicated.
   * @param pageNumber Optional page number (default: 1)
   * @param pageSize Optional page size
   * @param sort Optional raw sort string (e.g. firstName:asc)
   * @param query Optional raw name-search string (tokenized in the service)
   * @returns Promise with the combined Admin-LE assignment rows and optional total count
   */
  listOtherCompanyUsers(
    pageNumber?: number,
    pageSize?: number,
    sort?: string,
    query?: string,
  ): Promise<CompanyUserListResult>;

  /**
   * Get a company user by id
   * @param userId The identifier accepted by get, update, and delete
   * @returns Promise with the user or undefined if not found
   */
  getUser(userId: string): Promise<CompanyUser | undefined>;

  /**
   * Invite-create a company user (no password). Customer success may still
   * return failed group display names when a later group or LE step fails.
   * The request must contain exactly one group for the session-selected LE:
   * Customer Service enforces `Customer can only assign new customer to the same company`.
   * @param user Profile, activation, and the selected-LE group assignment
   * @returns Promise with the created user and optional failed group names
   */
  createUser(user: CreateCompanyUserRequest): Promise<CreateCompanyUserResult>;

  /**
   * Update a selected-LE assignment member, including activation and tri-state
   * group changes (omitted = unchanged, empty = unassign IAM while retaining CONTACT).
   * @param userId The identifier accepted by get, update, and delete
   * @param user Fields to apply on save
   * @returns Promise with the updated user
   */
  updateUser(userId: string, user: UpdateCompanyUserRequest): Promise<CompanyUser>;

  /**
   * Delete a company user
   * @param userId The identifier accepted by get, update, and delete
   * @returns Promise that resolves when the deletion is complete
   */
  deleteUser(userId: string): Promise<void>;

  /**
   * List assignable groups for only the session-selected legal entity. This
   * matches `Customer can only assign new customer to the same company`.
   * @returns Promise with exactly one selected-LE entry and its picker groups
   */
  listAssignableGroups(): Promise<AssignableLegalEntityGroups[]>;

  /**
   * Legal-entity ids where the current customer is Admin (IAM `b2b.role`, not
   * group name). Used by User Management to force All companies and disable
   * create when the session company is not an Admin LE (COP-4807).
   */
  listAdminLegalEntityIds(): Promise<string[]>;
}
