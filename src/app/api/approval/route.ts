import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ApprovalService } from '@/platform/services/approval/ApprovalService';
import { ApprovalCreateRequest } from '@/platform/services/model/approval';

export const revalidate = 0;

/**
 * GET /api/approval
 * Get all approvals with optional pagination, sorting, and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageNumber = searchParams.get('pageNumber') ? parseInt(searchParams.get('pageNumber')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 60;
    const sort = searchParams.get('sort') || undefined;
    const query = searchParams.get('query') || undefined;

    const approvalService = server.get<ApprovalService>('ApprovalService');
    const approvals = await approvalService.getApprovals(pageNumber, pageSize, sort, query);

    return NextResponse.json(approvals);
  } catch (error) {
    console.error('Error fetching approvals:', error);
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 });
  }
}

/**
 * POST /api/approval
 * Create a new approval
 */
export async function POST(request: NextRequest) {
  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');

    // Get request body
    const body: ApprovalCreateRequest = await request.json();

    // Create a new approval
    const approvalId = await approvalService.createApproval(body);

    return NextResponse.json(approvalId, { status: 201 });
  } catch (error) {
    console.error('Error creating approval:', error);
    return NextResponse.json({ error: 'Failed to create approval' }, { status: 500 });
  }
}
