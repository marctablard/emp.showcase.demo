import { z } from 'zod';
import { injectable } from '@/platform/core/di/injectable';
import ZodSchemaValidationService from './ZodSchemaValidationService';

// Registration validation schema
export const RegistrationSchema = z
  .object({
    firstName: z.string().min(1, 'register.firstName.required'),
    lastName: z.string().min(1, 'register.lastName.required'),
    email: z.string().min(1, 'register.email.required').email('register.email.invalid'),
    emailConfirmation: z.string().min(1, 'register.emailConfirmation.required'),
    companyName: z.string().optional(),
    businessType: z.string().optional(),
    street: z.string().min(1, 'register.street.required'),
    houseNumber: z.string().min(1, 'register.houseNumber.required'),
    postalCode: z.string().min(1, 'register.postalCode.required'),
    city: z.string().min(1, 'register.city.required'),
    country: z.string().min(1, 'register.country.required'),
    vatNumber: z.string().optional(),
    shippingSameAsBilling: z.boolean(),
    password: z.string().min(8).regex(/[A-Z]/).regex(/[a-z]/).regex(/[0-9]/),
    passwordConfirmation: z.string().min(1, 'register.passwordConfirmation.required'),
    additionalInformation: z.string().max(500).optional(),
    newsletter: z.boolean(),
    dealsAlerts: z.boolean(),
  })
  .refine((data) => data.email === data.emailConfirmation, {
    message: 'register.email.mismatch',
    path: ['emailConfirmation'],
  })
  .refine((data) => data.password === data.passwordConfirmation, {
    message: 'register.password.mismatch',
    path: ['passwordConfirmation'],
  })
  .refine(
    (data) => {
      return data.businessType === 'B2C' || (data.companyName && data.companyName.length > 0);
    },
    {
      message: 'register.companyName.required',
      path: ['companyName'],
    },
  )
  .refine(
    (data) => {
      return data.businessType === 'B2C' || (data.vatNumber && data.vatNumber.length > 0);
    },
    {
      message: 'register.vatNumber.required',
      path: ['vatNumber'],
    },
  );

// Export type for the registration data
export type RegistrationData = z.infer<typeof RegistrationSchema>;

@injectable('RegistrationValidationService', 'Singleton')
class EmporixRegistrationValidationService extends ZodSchemaValidationService {
  constructor() {
    super(RegistrationSchema);
  }
}

export default EmporixRegistrationValidationService;
