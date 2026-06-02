import { getLogger } from '@/lib/logger/use-logger-client';
import type { FormSubmissionFormData } from '@/platform/services/model/form-submission/form-submission';

export type FormSubmissionCreatePayload = {
  formData: FormSubmissionFormData;
};

export type FormSubmissionCreateResponse = {
  id: string;
};

/**
 * Submit a CMS contact form to the storefront API.
 */
export async function submitFormSubmission(
  payload: FormSubmissionCreatePayload,
): Promise<FormSubmissionCreateResponse> {
  const response = await fetch('/api/form-submissions', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message = typeof body.error === 'string' ? body.error : `Request failed (${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

export async function fetchFormSubmission(id: string) {
  try {
    const response = await fetch(`/api/form-submissions/${id}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch form submission: ${response.statusText}`);
    }
    return response.json();
  } catch (error) {
    getLogger().error({ err: error, id }, 'Error fetching form submission');
    throw error;
  }
}
