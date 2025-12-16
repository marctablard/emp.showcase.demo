import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

const AddressFormSchema = z.object({
  contactName: z.string().min(1, { message: 'address.contactName.required' }),
  street: z.string().min(1, { message: 'address.street.required' }),
  streetNumber: z.string().min(1, { message: 'address.streetNumber.required' }),
  zipCode: z.string().min(1, { message: 'address.zipCode.required' }),
  city: z.string().min(1, { message: 'address.city.required' }),
  country: z.string().min(1, { message: 'address.country.required' }),
  state: z.string().optional(),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
});

@injectable('AddressValidationService', 'Singleton')
class EmporixAddressValidationService extends ZodSchemaValidationService {
  constructor() {
    super(AddressFormSchema);
  }
}

export default EmporixAddressValidationService;
