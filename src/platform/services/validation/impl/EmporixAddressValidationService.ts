import { AddressFormSchema } from '@/lib/validation/form-schemas';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

@injectable('AddressValidationService', 'Singleton')
class EmporixAddressValidationService extends ZodSchemaValidationService {
  constructor() {
    super(AddressFormSchema);
  }
}

export default EmporixAddressValidationService;
