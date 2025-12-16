import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Profile edit validation schema
export const ProfileEditSchema = z.object({
  title: z.string().optional(),
  firstName: z.string().min(1, 'profile.form.firstName.required'),
  lastName: z.string().min(1, 'profile.form.lastName.required'),
  email: z.string().min(1, 'profile.form.email.required').email('profile.form.email.invalid'),
  phone: z
    .string()
    .optional()
    .refine(
      (val) => !val || /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/.test(val),
      'profile.form.phone.invalid',
    ),
  preferredLanguage: z.string(),
  preferredCurrency: z.string(),
});

@injectable('ProfileValidationService', 'Singleton')
class EmporixProfileValidationService extends ZodSchemaValidationService {
  constructor() {
    super(ProfileEditSchema);
  }
}

export default EmporixProfileValidationService;
