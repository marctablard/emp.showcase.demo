import type {
  FormSubmission,
  FormSubmissionCreateInput,
  FormSubmissionUpdateInput,
} from '../model/form-submission/form-submission';

/**
 * Service for managing FORMSUBMISSIONS custom entity instances.
 */
export interface FormSubmissionService {
  /**
   * Create a new form submission for the current site and session context.
   */
  createFormSubmission(input: FormSubmissionCreateInput): Promise<string>;

  /**
   * Get a form submission by ID.
   */
  getFormSubmission(id: string): Promise<FormSubmission>;

  /**
   * Update an existing form submission.
   */
  updateFormSubmission(id: string, input: FormSubmissionUpdateInput): Promise<void>;
}
