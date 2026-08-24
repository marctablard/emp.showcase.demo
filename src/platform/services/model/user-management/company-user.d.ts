/**
 * Company user shown in User Management (selected legal entity).
 * `id` is the identifier accepted by get, update, and delete.
 */
export interface CompanyUser {
  id: string;
  title?: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  contactPhone?: string;
  active: boolean;
  createdAt?: string;
  groups: CompanyUserGroup[];
  /** Present on combined Admin-LE list rows; omitted from selected-LE `listUsers`. */
  legalEntityId?: string;
  /** Present on combined Admin-LE list rows; omitted from selected-LE `listUsers`. */
  legalEntityName?: string;
  /**
   * Set on `getUser` only. True when the user is in the selected-LE contact-assignment
   * set; false for a Q24 other-Admin-LE get. Not inferred from selected-LE IAM groups.
   */
  isSelectedLegalEntityMember?: boolean;
}

/**
 * IAM group assigned to a company user, labeled for display.
 */
export interface CompanyUserGroup {
  id: string;
  legalEntityId: string;
  displayName: string;
}

/**
 * One predefined group selection for a permitted legal entity.
 */
export interface CompanyUserGroupAssignment {
  legalEntityId: string;
  groupId: string;
}

/**
 * Invite-create payload. Password is never accepted. Exactly one group for the
 * session-selected LE is required because Customer Service enforces
 * `Customer can only assign new customer to the same company`.
 */
export interface CreateCompanyUserRequest {
  title?: string;
  firstName: string;
  lastName: string;
  contactEmail: string;
  contactPhone?: string;
  active: boolean;
  groupAssignments: CompanyUserGroupAssignment[];
}

/**
 * Edit payload. Password is never accepted. Group assignments are tri-state:
 * omitted leaves IAM unchanged; `[]` / Contact-only remove selected-LE functional
 * IAM groups, keep CONTACT assignment, and ensure IAM Contact; one functional
 * catalog id assigns that selected-LE group (and still ensures Contact).
 */
export interface UpdateCompanyUserRequest {
  title?: string;
  firstName?: string;
  lastName?: string;
  contactEmail?: string;
  contactPhone?: string;
  active?: boolean;
  groupAssignments?: CompanyUserGroupAssignment[];
}

/**
 * Returned only when the customer was created. Hard failures throw instead.
 * Non-empty `failedGroupNames` means group or legal-entity linking partially failed.
 */
export interface CreateCompanyUserResult {
  user: CompanyUser;
  failedGroupNames?: string[];
}

/**
 * List query. `sort` and `query` are raw passthrough strings (not mapper-only fields).
 */
export interface CompanyUserListRequest {
  pageNumber?: number;
  pageSize?: number;
  sort?: string;
  query?: string;
}

export interface CompanyUserListResult {
  items: CompanyUser[];
  totalCount?: number;
}

/**
 * Group that may be offered in a per-legal-entity picker.
 */
export interface AssignableCompanyUserGroup {
  id: string;
  legalEntityId: string;
  legalEntityName: string;
  displayName: string;
}

/**
 * Groups for one permitted legal entity (one dropdown).
 */
export interface AssignableLegalEntityGroups {
  legalEntityId: string;
  legalEntityName: string;
  groups: AssignableCompanyUserGroup[];
}
