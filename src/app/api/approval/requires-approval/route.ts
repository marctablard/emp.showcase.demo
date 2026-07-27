import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isApprovalAction, isApprovalResourceType } from '@/lib/approval/contracts';
import { withApiRouteDebug } from '@/platform/core/utils/debug-utils';
import server from '@/platform/server';
import type { ApprovalService } from '@/platform/services/approval/ApprovalService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ApprovalAction, ApprovalResourceType } from '@/platform/services/model/approval';

/**
 * GET /api/approval/requires-approval
 * Check if a cart requires approval
 */
async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const resourceId = searchParams.get('resourceId') ?? searchParams.get('cartId');
  const rawResourceType = searchParams.get('resourceType');
  const rawAction = searchParams.get('action');

  try {
    if (!resourceId) {
      return NextResponse.json({ error: 'resourceId is required' }, { status: 400 });
    }

    if (rawResourceType && !isApprovalResourceType(rawResourceType)) {
      return NextResponse.json({ error: 'Invalid resourceType' }, { status: 400 });
    }

    if (rawAction && !isApprovalAction(rawAction)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const resourceType: ApprovalResourceType =
      rawResourceType && isApprovalResourceType(rawResourceType) ? rawResourceType : 'CART';
    const action: ApprovalAction = rawAction && isApprovalAction(rawAction) ? rawAction : 'CHECKOUT';

    const approvalService = server.get<ApprovalService>('ApprovalService');
    const requiresApproval = await approvalService.requiresApproval({
      resourceId,
      resourceType,
      action,
    });

    return NextResponse.json(requiresApproval);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/approval/requires-approval',
        method: 'GET',
        resourceId,
        resourceType: rawResourceType,
        action: rawAction,
      },
      'Error checking approval requirements',
    );
    return NextResponse.json(
      { error: 'Failed to check approval requirements', details: (error as Error).message },
      { status: 500 },
    );
  }
}

export const GET = withApiRouteDebug(handler);
