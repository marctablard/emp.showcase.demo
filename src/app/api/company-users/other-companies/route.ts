import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { USERS_PER_PAGE } from '@/components/account/account-table-constants';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { UserManagementService } from '@/platform/services/user-management/UserManagementService';
import { AdminRequiredError, USER_MANAGEMENT_ERROR_CODE } from '@/platform/services/user-management/errors';

const DEFAULT_PAGE_NUMBER = 1;
const ALLOWED_SORT_FIELDS = new Set(['firstName', 'lastName', 'contactEmail', 'metadataCreatedAt', 'active']);

class CompanyUsersQueryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CompanyUsersQueryValidationError';
  }
}

function parsePositivePageInt(value: string | null, name: string): number | undefined {
  if (value === null) {
    return undefined;
  }
  if (!/^\d+$/.test(value)) {
    throw new CompanyUsersQueryValidationError(`${name} must be a base-10 positive integer`);
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    throw new CompanyUsersQueryValidationError(`${name} must be >= 1`);
  }
  return parsed;
}

function parseCompanyUsersListQuery(searchParams: URLSearchParams): {
  pageNumber: number;
  pageSize: number;
  sortParam?: string;
  query?: string;
} {
  const pageNumber = parsePositivePageInt(searchParams.get('pageNumber'), 'pageNumber') ?? DEFAULT_PAGE_NUMBER;
  const pageSize = parsePositivePageInt(searchParams.get('pageSize'), 'pageSize') ?? USERS_PER_PAGE;
  const sortParam = searchParams.get('sort') || undefined;
  const query = searchParams.get('query') || undefined;
  if (sortParam && !isAllowedSort(sortParam)) {
    throw new CompanyUsersQueryValidationError('Invalid sort field');
  }
  return { pageNumber, pageSize, sortParam, query };
}

/**
 * GET /api/company-users/other-companies
 * List combined Admin-LE assignment rows (Q26) with the same page/sort/search
 * contract as GET /api/company-users. Sibling path — not merged into first-table GET.
 */
export async function GET(request: NextRequest) {
  try {
    const { pageNumber, pageSize, sortParam, query } = parseCompanyUsersListQuery(new URL(request.url).searchParams);

    const userManagementService = server.get<UserManagementService>('UserManagementService');
    const { items, totalCount } = await userManagementService.listOtherCompanyUsers(
      pageNumber,
      pageSize,
      sortParam,
      query,
    );

    if (totalCount === undefined) {
      return NextResponse.json(items);
    }

    return NextResponse.json(items, {
      headers: { 'x-total-count': String(totalCount) },
    });
  } catch (error) {
    if (error instanceof CompanyUsersQueryValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof AdminRequiredError) {
      return adminRequiredResponse(error);
    }
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/company-users/other-companies',
        method: 'GET',
      },
      'Error fetching other-company users',
    );
    return NextResponse.json({ error: 'Failed to fetch other-company users' }, { status: 500 });
  }
}

function isAllowedSort(sort: string): boolean {
  const [field, direction, extra] = sort.split(':');
  return extra === undefined && ALLOWED_SORT_FIELDS.has(field) && (direction === 'asc' || direction === 'desc');
}

function adminRequiredResponse(error: AdminRequiredError) {
  return NextResponse.json({ error: error.message, code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED }, { status: 403 });
}
