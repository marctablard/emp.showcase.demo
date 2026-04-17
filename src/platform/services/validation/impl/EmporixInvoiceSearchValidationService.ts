import { InvoiceSearchSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('InvoiceSearchValidationService', 'Singleton')
class EmporixInvoiceSearchValidationService extends ZodSchemaValidationService {
  constructor() {
    super(InvoiceSearchSchema);
  }
}

export default EmporixInvoiceSearchValidationService;
