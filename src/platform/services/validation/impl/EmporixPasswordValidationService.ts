import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Password change validation schema
export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'password.currentPassword.required'),
    newPassword: z
      .string()
      .min(1, 'password.newPassword.required')
      .min(8, 'password.newPassword.minLength')
      .regex(/(?=.*[a-z])/, 'password.newPassword.lowercase')
      .regex(/(?=.*[A-Z])/, 'password.newPassword.uppercase')
      .regex(/(?=.*\d)/, 'password.newPassword.number'),
    confirmPassword: z.string().min(1, 'password.confirmPassword.required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'password.confirmPassword.mismatch',
    path: ['confirmPassword'],
  });

@injectable('PasswordValidationService', 'Singleton')
class EmporixPasswordValidationService extends ZodSchemaValidationService {
  constructor() {
    super(PasswordChangeSchema);
  }
}

export default EmporixPasswordValidationService;
