import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isApprovalAction, isApprovalResourceType } from '@/lib/approval/contracts';
import server from '@/platform/server';
import type { ApprovalService } from '@/platform/services/approval/ApprovalService';
import { ApprovalAlreadyExistsError, ApprovalApproverNotPermittedError } from '@/platform/services/approval/errors';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { ApprovalCreateRequest } from '@/platform/services/model/approval';

const DEFAULT_APPROVAL_SORT = 'metadata.modifiedAt:desc';

/**
 * GET /api/approval
 * Get all approvals with optional pagination, sorting, and filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pageNumber = searchParams.get('pageNumber') ? parseInt(searchParams.get('pageNumber')!) : 1;
    const pageSize = searchParams.get('pageSize') ? parseInt(searchParams.get('pageSize')!) : 60;
    const sort = searchParams.get('sort') || DEFAULT_APPROVAL_SORT;
    const query = searchParams.get('query') || undefined;

    const approvalService = server.get<ApprovalService>('ApprovalService');
    const approvals = await approvalService.getApprovals(pageNumber, pageSize, sort, query);

    return NextResponse.json(approvals);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/approval',
        method: 'GET',
      },
      'Error fetching approvals',
    );
    return NextResponse.json({ error: 'Failed to fetch approvals' }, { status: 500 });
  }
}

/**
 * POST /api/approval
 * Create a new approval
 */
export async function POST(request: NextRequest) {
  let body: ApprovalCreateRequest | undefined;

  try {
    const approvalService = server.get<ApprovalService>('ApprovalService');

    // Get request body
    body = await request.json();

    if (
      !body?.resourceId ||
      !body?.approver?.userId ||
      !isApprovalResourceType(body.resourceType) ||
      !isApprovalAction(body.action)
    ) {
      return NextResponse.json({ error: 'Invalid approval request' }, { status: 400 });
    }

    // Create a new approval
    const approvalId = await approvalService.createApproval(body);

    return NextResponse.json(approvalId, { status: 201 });
  } catch (error) {
    if (error instanceof ApprovalAlreadyExistsError) {
      return NextResponse.json(
        {
          error: 'Approval already exists',
          code: 'APPROVAL_ALREADY_EXISTS',
          approvalId: error.approvalId,
        },
        { status: 409 },
      );
    }

    if (error instanceof ApprovalApproverNotPermittedError) {
      return NextResponse.json(
        {
          error: 'Selected approver is not permitted for this approval',
          code: 'APPROVER_NOT_PERMITTED',
          approverId: error.approverId,
        },
        { status: 403 },
      );
    }

    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/approval',
        method: 'POST',
        resourceType: body?.resourceType,
        resourceId: body?.resourceId,
        action: body?.action,
      },
      'Error creating approval',
    );
    return NextResponse.json(
      { error: 'Failed to create approval', details: error instanceof Error ? error.message : undefined },
      { status: 500 },
    );
  }
}
