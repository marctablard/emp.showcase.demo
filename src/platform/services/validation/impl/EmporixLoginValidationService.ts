import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Login validation schema
export const LoginSchema = z.object({
  username: z.string().min(1, 'login.username.required').email('login.username.invalid'),
  password: z.string().min(1, 'login.password.required'),
});

@injectable('LoginValidationService', 'Singleton')
class EmporixLoginValidationService extends ZodSchemaValidationService {
  constructor() {
    super(LoginSchema);
  }
}

export default EmporixLoginValidationService;
