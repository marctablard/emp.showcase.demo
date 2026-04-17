import { PaymentFormSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('PaymentValidationService', 'Singleton')
class EmporixPaymentValidationService extends ZodSchemaValidationService {
  constructor() {
    super(PaymentFormSchema);
  }
}

export default EmporixPaymentValidationService;
