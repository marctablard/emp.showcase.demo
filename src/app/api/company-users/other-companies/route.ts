import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { UserManagementService } from '@/platform/services/user-management/UserManagementService';
import { AdminRequiredError, USER_MANAGEMENT_ERROR_CODE } from '@/platform/services/user-management/errors';

const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = 5;
const ALLOWED_SORT_FIELDS = new Set(['firstName', 'lastName', 'contactEmail', 'metadataCreatedAt', 'active']);

/**
 * GET /api/company-users/other-companies
 * List combined Admin-LE assignment rows (Q26) with the same page/sort/search
 * contract as GET /api/company-users. Sibling path — not merged into first-table GET.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageNumber = searchParams.get('pageNumber') ? parseInt(searchParams.get('pageNumber')!) : DEFAULT_PAGE_NUMBER;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : DEFAULT_PAGE_SIZE;
    const sortParam = searchParams.get('sort') || undefined;
    const query = searchParams.get('query') || undefined;

    if (sortParam && !isAllowedSort(sortParam)) {
      return NextResponse.json({ error: 'Invalid sort field' }, { status: 400 });
    }

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
  const field = sort.split(':')[0];
  return ALLOWED_SORT_FIELDS.has(field);
}

function adminRequiredResponse(error: AdminRequiredError) {
  return NextResponse.json({ error: error.message, code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED }, { status: 403 });
}
