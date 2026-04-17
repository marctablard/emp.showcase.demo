import { LoginSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('LoginValidationService', 'Singleton')
class EmporixLoginValidationService extends ZodSchemaValidationService {
  constructor() {
    super(LoginSchema);
  }
}

export default EmporixLoginValidationService;
