import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

const ShippingFormSchema = z.object({
  methodId: z.string().min(1, 'shipping.methodId.required'),
});

@injectable('ShippingValidationService', 'Singleton')
class EmporixShippingValidationService extends ZodSchemaValidationService {
  constructor() {
    super(ShippingFormSchema);
  }
}

export default EmporixShippingValidationService;
