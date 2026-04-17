import { TicketSearchSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('TicketSearchValidationService', 'Singleton')
class EmporixTicketSearchValidationService extends ZodSchemaValidationService {
  constructor() {
    super(TicketSearchSchema);
  }
}

export default EmporixTicketSearchValidationService;
