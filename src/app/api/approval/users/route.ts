import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { ApprovalService } from '@/platform/services/approval/ApprovalService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * GET /api/approval/users
 * Search for users who can approve a specific resource
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resourceType = searchParams.get('resourceType');
  const resourceId = searchParams.get('resourceId');
  const action = searchParams.get('action');

  try {
    if (!resourceType || !resourceId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const approvalService = server.get<ApprovalService>('ApprovalService');
    const users = await approvalService.searchApprovalUsers(resourceType, resourceId, action);

    return NextResponse.json(users);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/approval/users',
        method: 'GET',
        resourceType,
        resourceId,
        action,
      },
      'Error searching approval users',
    );
    return NextResponse.json(
      { error: 'Failed to search approval users', details: (error as Error).message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/approval/users
 * Search for users who can be assigned as approvers
 */
export async function POST(request: NextRequest) {
  let resourceType: string | undefined;
  let resourceId: string | undefined;
  let action: string | undefined;

  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');

    // Get request body
    const body = await request.json();
    resourceType = body.resourceType;
    resourceId = body.resourceId;
    action = body.action;

    if (!resourceType || !resourceId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Search for approval users
    const users = await approvalService.searchApprovalUsers(resourceType, resourceId, action);

    return NextResponse.json(users);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/approval/users',
        method: 'POST',
        resourceType,
        resourceId,
        action,
      },
      'Error searching approval users',
    );
    return NextResponse.json(
      { error: 'Failed to search approval users', details: (error as Error).message },
      { status: 500 },
    );
  }
}
