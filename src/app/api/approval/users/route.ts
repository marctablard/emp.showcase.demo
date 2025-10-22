import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ApprovalService } from '@/platform/services/approval/ApprovalService';

export const revalidate = 0;

/**
 * GET /api/approval/users
 * Search for users who can approve a specific resource
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resourceType');
    const resourceId = searchParams.get('resourceId');
    const action = searchParams.get('action');

    if (!resourceType || !resourceId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const approvalService = server.get<ApprovalService>('ApprovalService');
    const users = await approvalService.searchApprovalUsers(resourceType, resourceId, action);

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error searching approval users:', error);
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
  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');

    // Get request body
    const body = await request.json();
    const { resourceType, resourceId, action } = body;

    if (!resourceType || !resourceId || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Search for approval users
    const users = await approvalService.searchApprovalUsers(resourceType, resourceId, action);

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error searching approval users:', error);
    return NextResponse.json(
      { error: 'Failed to search approval users', details: (error as Error).message },
      { status: 500 },
    );
  }
}
