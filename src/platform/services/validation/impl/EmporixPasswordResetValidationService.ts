import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Password Reset validation schema
export const PasswordResetSchema = z.object({
  email: z.string().min(1, 'password.email.required').email('password.email.invalid'),
});

@injectable('PasswordResetValidationService', 'Singleton')
class EmporixPasswordResetValidationService extends ZodSchemaValidationService {
  constructor() {
    super(PasswordResetSchema);
  }
}

export default EmporixPasswordResetValidationService;
