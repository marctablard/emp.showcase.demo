import { SummaryFormSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('SummaryValidationService', 'Singleton')
class DefaultSummaryValidationService extends ZodSchemaValidationService {
  constructor() {
    super(SummaryFormSchema);
  }
}

export default DefaultSummaryValidationService;
