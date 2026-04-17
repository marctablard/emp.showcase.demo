import { ContactDataSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('ContactDataValidationService', 'Singleton')
class EmporixContactDataValidationService extends ZodSchemaValidationService {
  constructor() {
    super(ContactDataSchema);
  }
}

export default EmporixContactDataValidationService;
