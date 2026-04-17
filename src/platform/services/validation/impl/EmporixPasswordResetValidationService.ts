import { PasswordResetSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('PasswordResetValidationService', 'Singleton')
class EmporixPasswordResetValidationService extends ZodSchemaValidationService {
  constructor() {
    super(PasswordResetSchema);
  }
}

export default EmporixPasswordResetValidationService;
