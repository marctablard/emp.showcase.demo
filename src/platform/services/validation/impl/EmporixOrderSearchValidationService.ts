import { OrderSearchSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('OrderSearchValidationService', 'Singleton')
class EmporixOrderSearchValidationService extends ZodSchemaValidationService {
  constructor() {
    super(OrderSearchSchema);
  }
}

export default EmporixOrderSearchValidationService;
