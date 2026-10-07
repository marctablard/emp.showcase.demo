import type {
  AssignableLegalEntityGroups,
  CompanyUser,
  CompanyUserListResult,
  CreateCompanyUserRequest,
  CreateCompanyUserResult,
  UpdateCompanyUserRequest,
} from '@/platform/services/model/user-management/company-user';
import { AdminRequiredError, USER_MANAGEMENT_ERROR_CODE } from '@/platform/services/user-management/errors';

class CompanyUserApiError extends Error {
  readonly code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'CompanyUserApiError';
    this.code = code;
  }
}

function parseTotalCountHeader(headers: Headers): number | undefined {
  const totalCountHeader = headers.get('x-total-count');
  const parsedTotalCount = totalCountHeader ? Number.parseInt(totalCountHeader, 10) : Number.NaN;
  return Number.isFinite(parsedTotalCount) ? parsedTotalCount : undefined;
}

function toCompanyUsersQueryString(pageNumber?: number, pageSize?: number, sort?: string, query?: string): string {
  const queryParams = new URLSearchParams();
  if (pageNumber !== undefined) {
    queryParams.append('pageNumber', pageNumber.toString());
  }
  if (pageSize !== undefined) {
    queryParams.append('pageSize', pageSize.toString());
  }
  if (sort) {
    queryParams.append('sort', sort);
  }
  if (query) {
    queryParams.append('query', query);
  }
  return queryParams.toString();
}

async function getCompanyUserApiError(response: Response, fallback: string): Promise<Error> {
  let errorData: { error?: string; details?: string; code?: string } = {};
  try {
    errorData = (await response.json()) as { error?: string; details?: string; code?: string };
  } catch {
    // Keep the fallback when the response is not JSON.
  }

  if (response.status === 403 && errorData.code === USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED) {
    return new AdminRequiredError(errorData.error);
  }

  return new CompanyUserApiError(errorData.details || errorData.error || fallback, errorData.code);
}

/**
 * Fetch a page of company users for the selected legal entity.
 * Reads `x-total-count` as forwarded by the BFF list route.
 */
export async function fetchCompanyUsers(
  pageNumber?: number,
  pageSize?: number,
  sort?: string,
  query?: string,
): Promise<CompanyUserListResult> {
  const queryString = toCompanyUsersQueryString(pageNumber, pageSize, sort, query);
  const url = queryString.length > 0 ? `/api/company-users?${queryString}` : '/api/company-users';
  const response = await fetch(url);

  if (!response.ok) {
    throw await getCompanyUserApiError(response, 'Failed to fetch company users');
  }

  const items = (await response.json()) as CompanyUser[];
  return {
    items,
    totalCount: parseTotalCountHeader(response.headers),
  };
}

/**
 * Fetch a page of combined Admin-LE assignment rows (Q26).
 * Appends the same `pageNumber`, `pageSize`, `sort`, and `query` keys as `fetchCompanyUsers`.
 */
export async function fetchOtherCompanyUsers(
  pageNumber?: number,
  pageSize?: number,
  sort?: string,
  query?: string,
): Promise<CompanyUserListResult> {
  const queryString = toCompanyUsersQueryString(pageNumber, pageSize, sort, query);
  const url =
    queryString.length > 0 ? `/api/company-users/other-companies?${queryString}` : '/api/company-users/other-companies';
  const response = await fetch(url);

  if (!response.ok) {
    throw await getCompanyUserApiError(response, 'Failed to fetch other-company users');
  }

  const items = (await response.json()) as CompanyUser[];
  return {
    items,
    totalCount: parseTotalCountHeader(response.headers),
  };
}

/**
 * Fetch a company user by id.
 */
export async function fetchCompanyUserById(userId: string): Promise<CompanyUser> {
  const response = await fetch(`/api/company-users/${encodeURIComponent(userId)}`);

  if (!response.ok) {
    throw await getCompanyUserApiError(response, 'Failed to fetch company user');
  }

  return response.json();
}

/**
 * Invite-create a company user (no password).
 * A 201 with `failedGroupNames` is a partial success after the customer was created.
 */
export async function createCompanyUser(user: CreateCompanyUserRequest): Promise<CreateCompanyUserResult> {
  const response = await fetch('/api/company-users', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    throw await getCompanyUserApiError(response, 'Failed to create company user');
  }

  return response.json();
}

/**
 * Update a company user, including activation and per-LE groups.
 */
export async function updateCompanyUser(userId: string, user: UpdateCompanyUserRequest): Promise<CompanyUser> {
  const response = await fetch(`/api/company-users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(user),
  });

  if (!response.ok) {
    throw await getCompanyUserApiError(response, 'Failed to update company user');
  }

  return response.json();
}

/**
 * Delete a company user.
 */
export async function deleteCompanyUser(userId: string): Promise<void> {
  const response = await fetch(`/api/company-users/${encodeURIComponent(userId)}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw await getCompanyUserApiError(response, 'Failed to delete company user');
  }
}

/**
 * Fetch assignable groups grouped by permitted legal entity.
 */
export async function fetchAssignableCompanyUserGroups(): Promise<AssignableLegalEntityGroups[]> {
  const response = await fetch('/api/company-users/groups');

  if (!response.ok) {
    throw await getCompanyUserApiError(response, 'Failed to fetch assignable groups');
  }

  return response.json();
}
