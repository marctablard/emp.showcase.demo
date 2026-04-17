import { PasswordChangeSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('PasswordValidationService', 'Singleton')
class EmporixPasswordValidationService extends ZodSchemaValidationService {
  constructor() {
    super(PasswordChangeSchema);
  }
}

export default EmporixPasswordValidationService;
