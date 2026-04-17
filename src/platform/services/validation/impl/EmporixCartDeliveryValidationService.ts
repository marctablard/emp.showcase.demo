import { CartDeliverySchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('CartDeliveryValidationService', 'Singleton')
class EmporixCartDeliveryValidationService extends ZodSchemaValidationService {
  constructor() {
    super(CartDeliverySchema);
  }
}

export default EmporixCartDeliveryValidationService;
