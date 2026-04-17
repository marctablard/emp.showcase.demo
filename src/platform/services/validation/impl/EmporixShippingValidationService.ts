import { ShippingFormSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('ShippingValidationService', 'Singleton')
class EmporixShippingValidationService extends ZodSchemaValidationService {
  constructor() {
    super(ShippingFormSchema);
  }
}

export default EmporixShippingValidationService;
