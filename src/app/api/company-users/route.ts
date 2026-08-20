import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { CreateCompanyUserRequest } from '@/platform/services/model/user-management/company-user';
import type { UserManagementService } from '@/platform/services/user-management/UserManagementService';
import {
  AdminRequiredError,
  PredefinedGroupConflictError,
  USER_MANAGEMENT_ERROR_CODE,
} from '@/platform/services/user-management/errors';

const DEFAULT_PAGE_NUMBER = 1;
const DEFAULT_PAGE_SIZE = 5;
const ALLOWED_SORT_FIELDS = new Set(['firstName', 'lastName', 'contactEmail', 'metadataCreatedAt', 'active']);
const SAME_COMPANY_REQUIRED_MESSAGE = 'Customer can only assign new customer to the same company';

/**
 * GET /api/company-users
 * List selected-LE company users with optional pagination, sorting, and name search
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
    const { items, totalCount } = await userManagementService.listUsers(pageNumber, pageSize, sortParam, query);

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
        path: '/api/company-users',
        method: 'GET',
      },
      'Error fetching company users',
    );
    return NextResponse.json({ error: 'Failed to fetch company users' }, { status: 500 });
  }
}

/**
 * POST /api/company-users
 * Invite-create a company user (no password)
 */
export async function POST(request: NextRequest) {
  let createRequestForLog: CreateCompanyUserRequest | undefined;

  try {
    const body = await request.json();
    const createRequest = parseCreateBody(body);

    if (!createRequest) {
      return NextResponse.json({ error: 'Invalid company user request' }, { status: 400 });
    }
    createRequestForLog = createRequest;

    const userManagementService = server.get<UserManagementService>('UserManagementService');
    const result = await userManagementService.createUser(createRequest);

    if (result.failedGroupNames && result.failedGroupNames.length > 0) {
      return NextResponse.json(
        {
          user: result.user,
          failedGroupNames: result.failedGroupNames,
          warning: { failedGroupNames: result.failedGroupNames },
        },
        { status: 201 },
      );
    }

    return NextResponse.json(result, { status: 201 });
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
        ...toPostErrorLogContext(error),
        tokenType: 'service',
        createDtoKeys: getAttachedCreateDtoKeys(error) ?? Object.keys(createRequestForLog ?? {}),
        path: '/api/company-users',
        method: 'POST',
      },
      'Error creating company user',
    );
    const upstreamStatus = getUpstreamStatus(error);
    if (upstreamStatus === 400) {
      const upstreamMessage = getParsedUpstreamMessage(error);
      if (upstreamMessage === SAME_COMPANY_REQUIRED_MESSAGE) {
        return NextResponse.json(
          {
            error: SAME_COMPANY_REQUIRED_MESSAGE,
            code: USER_MANAGEMENT_ERROR_CODE.SAME_COMPANY_REQUIRED,
          },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: 'Failed to create company user' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create company user' }, { status: 500 });
  }
}

function isAllowedSort(sort: string): boolean {
  const field = sort.split(':')[0];
  return ALLOWED_SORT_FIELDS.has(field);
}

function parseCreateBody(body: unknown): CreateCompanyUserRequest | undefined {
  if (!body || typeof body !== 'object') {
    return undefined;
  }

  const data = body as Record<string, unknown>;
  if (typeof data.firstName !== 'string' || !data.firstName.trim()) {
    return undefined;
  }
  if (typeof data.lastName !== 'string' || !data.lastName.trim()) {
    return undefined;
  }
  if (typeof data.contactEmail !== 'string' || !data.contactEmail.trim()) {
    return undefined;
  }
  if (!Array.isArray(data.groupAssignments)) {
    return undefined;
  }

  const groupAssignments = [];
  for (const assignment of data.groupAssignments) {
    if (!assignment || typeof assignment !== 'object') {
      return undefined;
    }
    const item = assignment as Record<string, unknown>;
    if (typeof item.legalEntityId !== 'string' || !item.legalEntityId.trim()) {
      return undefined;
    }
    if (typeof item.groupId !== 'string' || !item.groupId.trim()) {
      return undefined;
    }
    groupAssignments.push({ legalEntityId: item.legalEntityId, groupId: item.groupId });
  }

  const request: CreateCompanyUserRequest = {
    firstName: data.firstName,
    lastName: data.lastName,
    contactEmail: data.contactEmail,
    active: data.active === true,
    groupAssignments,
  };

  if (typeof data.title === 'string' && data.title.trim()) {
    request.title = data.title;
  }
  if (typeof data.contactPhone === 'string' && data.contactPhone.trim()) {
    request.contactPhone = data.contactPhone;
  }

  return request;
}

function adminRequiredResponse(error: AdminRequiredError) {
  return NextResponse.json({ error: error.message, code: USER_MANAGEMENT_ERROR_CODE.ADMIN_REQUIRED }, { status: 403 });
}

function toPostErrorLogContext(error: unknown): Record<string, unknown> {
  const attached = getErrorRecord(error)?.userManagementLogContext;
  if (attached && typeof attached === 'object' && !Array.isArray(attached)) {
    const context = attached as Record<string, unknown>;
    return {
      status: typeof context.status === 'number' ? context.status : undefined,
      statusText: typeof context.statusText === 'string' ? context.statusText : undefined,
      operation: typeof context.operation === 'string' ? context.operation : 'Create customer',
    };
  }

  const errorRecord = getErrorRecord(error);
  return {
    status: typeof errorRecord?.status === 'number' ? errorRecord.status : undefined,
    statusText: typeof errorRecord?.statusText === 'string' ? errorRecord.statusText : undefined,
    operation: typeof errorRecord?.operation === 'string' ? errorRecord.operation : 'Create customer',
  };
}

function getUpstreamStatus(error: unknown): number | undefined {
  const errorRecord = getErrorRecord(error);
  if (typeof errorRecord?.status === 'number') {
    return errorRecord.status;
  }
  const attached = errorRecord?.userManagementLogContext;
  if (!attached || typeof attached !== 'object' || Array.isArray(attached)) {
    return undefined;
  }
  const status = (attached as Record<string, unknown>).status;
  return typeof status === 'number' ? status : undefined;
}

function getParsedUpstreamMessage(error: unknown): string | undefined {
  const body = getErrorRecord(error)?.body;
  if (typeof body !== 'string') {
    return undefined;
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }
    const message = (parsed as Record<string, unknown>).message;
    return typeof message === 'string' ? message : undefined;
  } catch {
    return undefined;
  }
}

function getAttachedCreateDtoKeys(error: unknown): string[] | undefined {
  const context = getErrorRecord(error)?.userManagementLogContext;
  if (!context || typeof context !== 'object' || Array.isArray(context)) {
    return undefined;
  }
  const keys = (context as Record<string, unknown>).createDtoKeys;
  return Array.isArray(keys) && keys.every((key) => typeof key === 'string') ? keys : undefined;
}

function getErrorRecord(error: unknown): Record<string, unknown> | undefined {
  return error && typeof error === 'object' ? (error as Record<string, unknown>) : undefined;
}
