import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { UpdateCompanyUserRequest } from '@/platform/services/model/user-management/company-user';
import type { UserManagementService } from '@/platform/services/user-management/UserManagementService';
import {
  AdminRequiredError,
  PredefinedGroupConflictError,
  USER_MANAGEMENT_ERROR_CODE,
} from '@/platform/services/user-management/errors';

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/company-users/[id]
 * Get a company user by id
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const userManagementService = server.get<UserManagementService>('UserManagementService');
    const user = await userManagementService.getUser(id);

    if (!user) {
      return NextResponse.json({ error: 'Company user not found' }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return adminRequiredResponse(error);
    }
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/company-users/${id}`,
        method: 'GET',
        userId: id,
      },
      `Error fetching company user ${id}`,
    );
    return NextResponse.json({ error: 'Failed to fetch company user' }, { status: 500 });
  }
}

/**
 * PATCH /api/company-users/[id]
 * Update a company user, including activation and per-LE groups
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const body = await request.json();
    const updateRequest = parseUpdateBody(body);

    if (!updateRequest) {
      return NextResponse.json({ error: 'Invalid company user update' }, { status: 400 });
    }

    const userManagementService = server.get<UserManagementService>('UserManagementService');
    const user = await userManagementService.updateUser(id, updateRequest);

    return NextResponse.json(user);
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return adminRequiredResponse(error);
    }
    if (error instanceof PredefinedGroupConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: USER_MANAGEMENT_ERROR_CODE.PREDEFINED_GROUP_CONFLICT,
        },
        { status: 400 },
      );
    }

    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/company-users/${id}`,
        method: 'PATCH',
        userId: id,
      },
      `Error updating company user ${id}`,
    );
    return NextResponse.json({ error: 'Failed to update company user' }, { status: 500 });
  }
}

/**
 * DELETE /api/company-users/[id]
 * Delete a company user
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const userManagementService = server.get<UserManagementService>('UserManagementService');
    await userManagementService.deleteUser(id);

    return new Response(null, { status: 204 });
  } catch (error) {
    if (error instanceof AdminRequiredError) {
      return adminRequiredResponse(error);
    }

    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: `/api/company-users/${id}`,
        method: 'DELETE',
        userId: id,
      },
      `Error deleting company user ${id}`,
    );
    return NextResponse.json({ error: 'Failed to delete company user' }, { status: 500 });
  }
}

function readTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined;
}

function parseGroupAssignment(assignment: unknown): { legalEntityId: string; groupId: string } | undefined {
  if (!assignment || typeof assignment !== 'object') {
    return undefined;
  }
  const item = assignment as Record<string, unknown>;
  const legalEntityId = readTrimmedString(item.legalEntityId);
  const groupId = readTrimmedString(item.groupId);
  if (!legalEntityId || !groupId) {
    return undefined;
  }
  return { legalEntityId, groupId };
}

function parseGroupAssignments(value: unknown): Array<{ legalEntityId: string; groupId: string }> | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const groupAssignments = [];
  for (const assignment of value) {
    const parsed = parseGroupAssignment(assignment);
    if (!parsed) {
      return undefined;
    }
    groupAssignments.push(parsed);
  }
  return groupAssignments;
}

const TRIMMED_UPDATE_FIELDS = [
  ['title', false],
  ['firstName', true],
  ['lastName', true],
  ['contactEmail', true],
  ['contactPhone', false],
] as const;

function parseOptionalTrimmedField(
  data: Record<string, unknown>,
  key: (typeof TRIMMED_UPDATE_FIELDS)[number][0],
  required: boolean,
): string | undefined | false {
  if (data[key] === undefined) {
    return undefined;
  }
  const trimmed = readTrimmedString(data[key]);
  if (trimmed === undefined || (required && !trimmed)) {
    return false;
  }
  return trimmed;
}

function assignTrimmedUpdateFields(data: Record<string, unknown>, request: UpdateCompanyUserRequest): boolean {
  for (const [key, required] of TRIMMED_UPDATE_FIELDS) {
    const value = parseOptionalTrimmedField(data, key, required);
    if (value === false) {
      return false;
    }
    if (value !== undefined) {
      request[key] = value;
    }
  }
  return true;
}

function parseUpdateBody(body: unknown): UpdateCompanyUserRequest | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const data = body as Record<string, unknown>;
  const request: UpdateCompanyUserRequest = {};
  if (!assignTrimmedUpdateFields(data, request)) {
    return undefined;
  }

  if (data.active !== undefined) {
    if (typeof data.active !== 'boolean') {
      return undefined;
    }
    request.active = data.active;
  }
  if (data.groupAssignments !== undefined) {
    const groupAssignments = parseGroupAssignments(data.groupAssignments);
    if (!groupAssignments) {
      return undefined;
    }
    request.groupAssignments = groupAssignments;
  }

  return request;
}

function adminRequiredResponse(error: AdminRequiredError) {
  return NextResponse.json({ error: error.message, code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED }, { status: 403 });
}
