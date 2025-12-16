import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ApprovalService } from '@/platform/services/approval/ApprovalService';
import { ApprovalPermittedRequest } from '@/platform/services/model/approval';

export const revalidate = 0;

/**
 * POST /api/approval/permitted
 * Check if an action is permitted for a resource
 */
export async function POST(request: NextRequest) {
  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');

    // Get request body
    const body: ApprovalPermittedRequest = await request.json();

    // Check if action is permitted
    const result = await approvalService.checkApprovalPermitted(body);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error checking approval permission:', error);
    return NextResponse.json({ error: 'Failed to check approval permission' }, { status: 500 });
  }
}
