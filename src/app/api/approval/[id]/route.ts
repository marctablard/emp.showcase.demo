import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import { ApprovalService } from '@/platform/services/approval/ApprovalService';
import { ApprovalStatus } from '@/platform/services/model/approval';

export const revalidate = 0;

interface RouteParams {
  params: Promise<{
    id: string;
  }>;
}

/**
 * GET /api/approval/[id]
 * Get a specific approval by ID
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');
    const approval = await approvalService.getApproval(id);

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    return NextResponse.json(approval);
  } catch (error) {
    console.error(`Error fetching approval ${id}:`, error);
    return NextResponse.json({ error: 'Failed to fetch approval' }, { status: 500 });
  }
}

/**
 * PATCH /api/approval/[id]
 * Update an approval
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');
    const body = await request.json();

    // Check which update operation is requested
    if (body.status) {
      // Update status
      await approvalService.updateApprovalStatus(id, body.status as ApprovalStatus);
    } else if (body.approverComment !== undefined) {
      // Update approver comment
      await approvalService.updateApproverComment(id, body.approverComment);
    } else if (body.requestorComment !== undefined) {
      // Update requestor comment
      await approvalService.updateRequestorComment(id, body.requestorComment);
    } else {
      return NextResponse.json({ error: 'Invalid update request' }, { status: 400 });
    }

    // Return the updated approval
    const updatedApproval = await approvalService.getApproval(id);
    return NextResponse.json(updatedApproval);
  } catch (error) {
    console.error(`Error updating approval ${id}:`, error);
    return NextResponse.json({ error: 'Failed to update approval' }, { status: 500 });
  }
}

/**
 * DELETE /api/approval/[id]
 * Delete an approval
 */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');
    await approvalService.deleteApproval(id);

    return new Response(null, { status: 204 });
  } catch (error) {
    console.error(`Error deleting approval ${id}:`, error);
    return NextResponse.json({ error: 'Failed to delete approval' }, { status: 500 });
  }
}
