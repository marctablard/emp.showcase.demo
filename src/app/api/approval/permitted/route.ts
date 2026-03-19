import { NextRequest, NextResponse } from 'next/server';
import { withApiRouteDebug } from '@/platform/core/utils/debug-utils';
import server from '@/platform/server';
import { ApprovalService } from '@/platform/services/approval/ApprovalService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { ApprovalPermittedRequest } from '@/platform/services/model/approval';

/**
 * POST /api/approval/permitted
 * Check if an action is permitted for a resource
 */
async function handler(request: NextRequest) {
  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');

    // Get request body
    const body: ApprovalPermittedRequest = await request.json();

    // Check if action is permitted
    const result = await approvalService.checkApprovalPermitted(body);

    return NextResponse.json(result);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/approval/permitted',
        method: 'POST',
      },
      'Error checking approval permission',
    );
    return NextResponse.json({ error: 'Failed to check approval permission' }, { status: 500 });
  }
}

export const POST = withApiRouteDebug(handler);
