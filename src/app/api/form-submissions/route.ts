import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import server from '@/platform/server';
import type { FormSubmissionService } from '@/platform/services/form-submission/FormSubmissionService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import type { FormSubmissionFormData } from '@/platform/services/model/form-submission/form-submission';

type CreateBody = {
  formData?: FormSubmissionFormData;
};

function validateFormData(formData: FormSubmissionFormData | undefined): string | null {
  if (!formData?.subject?.trim()) {
    return 'Subject is required';
  }
  if (formData.email !== undefined && formData.email !== '' && !formData.email.includes('@')) {
    return 'A valid email address is required';
  }
  return null;
}

/**
 * POST /api/form-submissions
 * Create a new form submission custom entity instance.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CreateBody;
    const validationError = validateFormData(body.formData);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const formSubmissionService = server.get<FormSubmissionService>('FormSubmissionService');
    const id = await formSubmissionService.createFormSubmission({
      formData: {
        subject: body.formData!.subject.trim(),
        email: body.formData!.email?.trim() || undefined,
        phone: body.formData!.phone?.trim() || undefined,
        description: body.formData!.description?.trim() || undefined,
      },
    });

    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error(
      {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        path: '/api/form-submissions',
        method: 'POST',
      },
      'Error creating form submission',
    );
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create form submission' },
      { status: 500 },
    );
  }
}
