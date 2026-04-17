import { ProfileEditSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('ProfileValidationService', 'Singleton')
class EmporixProfileValidationService extends ZodSchemaValidationService {
  constructor() {
    super(ProfileEditSchema);
  }
}

export default EmporixProfileValidationService;
