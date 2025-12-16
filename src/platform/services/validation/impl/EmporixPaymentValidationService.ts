import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

const PaymentFormSchema = z
  .object({
    id: z.string().min(1, 'payment.id.required'),
    cardNumber: z.string().optional(),
    cardHolder: z.string().optional(),
    expiryDate: z.string().optional(),
    cvv: z.string().optional(),
    additionalInvoice: z.string().optional(),
  })
  .passthrough();

@injectable('PaymentValidationService', 'Singleton')
class EmporixPaymentValidationService extends ZodSchemaValidationService {
  constructor() {
    super(PaymentFormSchema);
  }
}

export default EmporixPaymentValidationService;
