import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ApprovalService } from '@/platform/services/approval/ApprovalService';

export const revalidate = 0;

/**
 * GET /api/approval/requires-approval
 * Check if a cart requires approval
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const cartId = searchParams.get('cartId');

    if (!cartId) {
      return NextResponse.json({ error: 'Cart ID is required' }, { status: 400 });
    }

    const approvalService = server.get<ApprovalService>('ApprovalService');
    const requiresApproval = await approvalService.requiresApproval(cartId);

    return NextResponse.json(requiresApproval);
  } catch (error) {
    console.error('Error checking approval requirements:', error);
    return NextResponse.json(
      { error: 'Failed to check approval requirements', details: (error as Error).message },
      { status: 500 },
    );
  }
}
