import { AiHelperSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('AiHelperValidationService', 'Singleton')
class EmporixAiHelperValidationService extends ZodSchemaValidationService {
  constructor() {
    super(AiHelperSchema);
  }
}

export default EmporixAiHelperValidationService;
