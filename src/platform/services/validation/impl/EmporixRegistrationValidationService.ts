import { RegistrationSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('RegistrationValidationService', 'Singleton')
class EmporixRegistrationValidationService extends ZodSchemaValidationService {
  constructor() {
    super(RegistrationSchema);
  }
}

export default EmporixRegistrationValidationService;
