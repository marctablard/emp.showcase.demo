'use client';

import { ClientZodSchemaValidationService } from '@/lib/validation/client-zod-schema-validation-service';
import {
  AddressFormSchema,
  AiHelperSchema,
  CartDeliverySchema,
  ContactDataSchema,
  InvoiceSearchSchema,
  LoginSchema,
  OrderSearchSchema,
  PasswordChangeSchema,
  PasswordResetSchema,
  PaymentFormSchema,
  ProfileEditSchema,
  RegistrationSchema,
  SavedCartSearchSchema,
  ShippingFormSchema,
  SummaryFormSchema,
  TicketSearchSchema,
} from '@/lib/validation/form-schemas';
import type { ValidationService } from '@/platform/services/validation';

const validators: Record<string, ValidationService> = {
  LoginValidationService: new ClientZodSchemaValidationService(LoginSchema),
  AddressValidationService: new ClientZodSchemaValidationService(AddressFormSchema),
  ContactDataValidationService: new ClientZodSchemaValidationService(ContactDataSchema),
  PasswordValidationService: new ClientZodSchemaValidationService(PasswordChangeSchema),
  PasswordResetValidationService: new ClientZodSchemaValidationService(PasswordResetSchema),
  ProfileValidationService: new ClientZodSchemaValidationService(ProfileEditSchema),
  PaymentValidationService: new ClientZodSchemaValidationService(PaymentFormSchema),
  ShippingValidationService: new ClientZodSchemaValidationService(ShippingFormSchema),
  SummaryValidationService: new ClientZodSchemaValidationService(SummaryFormSchema),
  CartDeliveryValidationService: new ClientZodSchemaValidationService(CartDeliverySchema),
  AiHelperValidationService: new ClientZodSchemaValidationService(AiHelperSchema),
  InvoiceSearchValidationService: new ClientZodSchemaValidationService(InvoiceSearchSchema),
  OrderSearchValidationService: new ClientZodSchemaValidationService(OrderSearchSchema),
  TicketSearchValidationService: new ClientZodSchemaValidationService(TicketSearchSchema),
  RegistrationValidationService: new ClientZodSchemaValidationService(RegistrationSchema),
  SavedCartSearchValidationService: new ClientZodSchemaValidationService(SavedCartSearchSchema),
};

export function getValidator(id: string): ValidationService {
  const validator = validators[id];
  if (!validator) {
    throw new Error(`Unknown validator: ${id}`);
  }
  return validator;
}
