import { z } from 'zod';

export const LoginSchema = z.object({
  username: z.string().min(1, 'login.username.required').email('login.username.invalid'),
  password: z.string().min(1, 'login.password.required'),
});

export const AddressFormSchema = z.object({
  contactName: z.string().min(1, { message: 'address.contactName.required' }),
  street: z.string().min(1, { message: 'address.street.required' }),
  streetNumber: z.string().optional(),
  zipCode: z.string().min(1, { message: 'address.zipCode.required' }),
  city: z.string().min(1, { message: 'address.city.required' }),
  country: z.string().min(1, { message: 'address.country.required' }),
  state: z.string().optional(),
  phoneNumber: z.string().optional(),
  companyName: z.string().optional(),
});

export const ContactDataSchema = z.object({
  firstName: z.string().min(1, 'contactData.firstName.required'),
  lastName: z.string().min(1, 'contactData.lastName.required'),
  email: z.string().min(1, 'register.email.required').email('register.email.invalid'),
  emailConfirmation: z.string().min(1, 'register.emailConfirmation.required'),
});

export const PasswordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'password.currentPassword.required'),
    newPassword: z
      .string()
      .min(1, 'password.newPassword.required')
      .min(8, 'password.newPassword.minLength')
      .regex(/(?=.*[a-z])/, 'password.newPassword.lowercase')
      .regex(/(?=.*[A-Z])/, 'password.newPassword.uppercase')
      .regex(/(?=.*\d)/, 'password.newPassword.number'),
    confirmPassword: z.string().min(1, 'password.confirmPassword.required'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'password.confirmPassword.mismatch',
    path: ['confirmPassword'],
  });

export const PasswordResetSchema = z.object({
  email: z.string().min(1, 'password.email.required').email('password.email.invalid'),
});

export const ProfileEditSchema = z.object({
  title: z.string().optional(),
  firstName: z.string().min(1, 'profile.form.firstName.required'),
  lastName: z.string().min(1, 'profile.form.lastName.required'),
  email: z.string().min(1, 'profile.form.email.required').email('profile.form.email.invalid'),
  phone: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      if (!/^[+0-9()\s.\-]+$/.test(val)) return false;
      // Structural checks: reject malformed punctuation patterns
      if (/\+.*\+/.test(val)) return false; // multiple + signs
      if (val.includes('+') && !val.startsWith('+')) return false; // + not at start
      const openParens = (val.match(/\(/g) || []).length;
      const closeParens = (val.match(/\)/g) || []).length;
      if (openParens !== closeParens) return false; // unbalanced parentheses
      if (/\)[^)\s.\-]*\(/.test(val)) return false; // closing before opening in wrong order
      let digits = val.replace(/[^0-9]/g, '');
      if (digits.startsWith('00')) {
        digits = digits.slice(2);
      } else if (val.startsWith('+')) {
        // + prefix already stripped by replace, digits start with country code
      }
      return digits.length >= 7 && digits.length <= 15;
    }, 'profile.form.phone.invalid'),
  preferredLanguage: z.string(),
  preferredCurrency: z.string(),
});

export const PaymentFormSchema = z
  .object({
    id: z.string().min(1, 'payment.method.required'),
    cardNumber: z.string().optional(),
    cardHolder: z.string().optional(),
    expiryDate: z.string().optional(),
    cvv: z.string().optional(),
    additionalInvoice: z.string().optional(),
  })
  .passthrough();

export const ShippingFormSchema = z.object({
  methodId: z.string().min(1, 'shipping.method.required'),
});

export const SummaryFormSchema = z.object({
  termsAndConditions: z.boolean(),
});

export const CartDeliverySchema = z.object({
  deliveryMethod: z.enum(['delivery', 'pickup']),
});

export type CartDeliveryData = z.infer<typeof CartDeliverySchema>;

export const AiHelperSchema = z.object({
  question: z.string().min(1, 'aiHelper.question.required'),
});

export const InvoiceSearchSchema = z.object({
  searchQuery: z.string().optional(),
});

export const OrderSearchSchema = z.object({
  searchQuery: z.string().optional(),
});

export const TicketSearchSchema = z.object({
  searchQuery: z.string().optional(),
});

export const SavedCartSearchSchema = z.object({
  searchQuery: z.string().optional(),
});

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

export type RegistrationData = z.infer<typeof RegistrationSchema>;
