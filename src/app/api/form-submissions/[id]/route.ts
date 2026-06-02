import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { FormSubmissionService } from '@/platform/services/form-submission/FormSubmissionService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { FormSubmissionUpdateInput } from '@/platform/services/model/form-submission/form-submission';

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * GET /api/form-submissions/[id]
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const formSubmissionService = server.get<FormSubmissionService>('FormSubmissionService');
    const submission = await formSubmissionService.getFormSubmission(id);
    return NextResponse.json(submission);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        id,
        path: '/api/form-submissions/[id]',
        method: 'GET',
      },
      'Error fetching form submission',
    );
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch form submission' },
      { status },
    );
  }
}

/**
 * PUT /api/form-submissions/[id]
 */
export async function PUT(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  try {
    const body = (await request.json()) as FormSubmissionUpdateInput;
    const formSubmissionService = server.get<FormSubmissionService>('FormSubmissionService');
    await formSubmissionService.updateFormSubmission(id, body);
    return NextResponse.json({ success: true });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        id,
        path: '/api/form-submissions/[id]',
        method: 'PUT',
      },
      'Error updating form submission',
    );
    const status = error instanceof Error && error.message.includes('not found') ? 404 : 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update form submission' },
      { status },
    );
  }
}
