import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withApiRouteDebug } from '@/platform/core/utils/debug-utils';
import server from '@/platform/server';
import type { ApprovalService } from '@/platform/services/approval/ApprovalService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

/**
 * GET /api/approval/requires-approval
 * Check if a cart requires approval
 */
async function handler(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const cartId = searchParams.get('cartId');

  try {
    if (!cartId) {
      return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 });
    }

    const approvalService = server.get<ApprovalService>('ApprovalService');
    const requiresApproval = await approvalService.requiresApproval(cartId);

    return NextResponse.json(requiresApproval);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/approval/requires-approval',
        method: 'GET',
        cartId,
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
