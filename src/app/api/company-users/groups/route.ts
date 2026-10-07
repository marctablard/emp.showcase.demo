import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { UserManagementService } from '@/platform/services/user-management/UserManagementService';
import { AdminRequiredError, USER_MANAGEMENT_ERROR_CODE } from '@/platform/services/user-management/errors';

/**
 * GET /api/company-users/groups
 * List assignable groups grouped by permitted legal entity
 */
export async function GET() {
  try {
    const userManagementService = server.get<UserManagementService>('UserManagementService');
    const groups = await userManagementService.listAssignableGroups();

    return NextResponse.json(groups);
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return NextResponse.json(
        { error: error.message, code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED },
        { status: 403 },
      );
    }

    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/company-users/groups',
        method: 'GET',
      },
      'Error fetching assignable company-user groups',
    );
    return NextResponse.json({ error: 'Failed to fetch assignable groups' }, { status: 500 });
  }
}
