import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Invoice Search validation schema
export const InvoiceSearchSchema = z.object({
  searchQuery: z.string().optional(),
});

@injectable('InvoiceSearchValidationService', 'Singleton')
class EmporixInvoiceSearchValidationService extends ZodSchemaValidationService {
  constructor() {
    super(InvoiceSearchSchema);
  }
}

export default EmporixInvoiceSearchValidationService;
