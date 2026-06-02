/**
 * Form fields captured from a CMS contact form submission.
 */
export interface FormSubmissionFormData {
  subject: string;
  email?: string;
  phone?: string;
  description?: string;
}

export interface FormSubmissionCustomerRef {
  customerId?: string;
  companyId?: string;
}

export interface FormSubmissionSite {
  siteCode: string;
}

/**
 * Domain model for a FORMSUBMISSIONS custom entity instance.
 */
export interface FormSubmission {
  id: string;
  name: string;
  formData: FormSubmissionFormData;
  customer?: FormSubmissionCustomerRef;
  site: FormSubmissionSite;
  created?: string;
  modified?: string;
}

export interface FormSubmissionCreateInput {
  formData: FormSubmissionFormData;
}

export interface FormSubmissionUpdateInput {
  formData?: Partial<FormSubmissionFormData>;
}
