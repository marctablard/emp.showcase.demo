import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Customer validation schema
export const ContactDataSchema = z.object({
  firstName: z.string().min(1, 'contactData.firstName.required'),
  lastName: z.string().min(1, 'contactData.lastName.required'),
  email: z.string().min(1, 'register.email.required').email('register.email.invalid'),
  emailConfirmation: z.string().min(1, 'register.emailConfirmation.required'),
});

@injectable('ContactDataValidationService', 'Singleton')
class EmporixContactDataValidationService extends ZodSchemaValidationService {
  constructor() {
    super(ContactDataSchema);
  }
}

export default EmporixContactDataValidationService;
