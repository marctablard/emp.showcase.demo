export const USER_MANAGEMENT_ERROR_CODE = {
  ADMIN_REQUIRED: 'ADMIN_REQUIRED',
  SAME_COMPANY_REQUIRED: 'SAME_COMPANY_REQUIRED',
  PREDEFINED_GROUP_CONFLICT: 'PREDEFINED_GROUP_CONFLICT',
  DUPLICATE_ACCOUNT: 'DUPLICATE_ACCOUNT',
} as const;

export type UserManagementErrorCode = (typeof USER_MANAGEMENT_ERROR_CODE)[keyof typeof USER_MANAGEMENT_ERROR_CODE];

export class AdminRequiredError extends Error {
  readonly code: UserManagementErrorCode = USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED;

  constructor(message: string = 'B2B admin role is required') {
    super(message);
    this.name = 'AdminRequiredError';
  }
}

export class PredefinedGroupConflictError extends Error {
  readonly code: UserManagementErrorCode = USER_MANAGEMENT_ERROR_CODE.PREDEFINED_GROUP_CONFLICT;

  constructor(message: string) {
    super(message);
    this.name = 'PredefinedGroupConflictError';
  }
}
