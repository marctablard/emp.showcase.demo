import { RegistrationSchema } from './form-schemas';

describe('RegistrationSchema – conditional billing fields', () => {
  const baseValid = {
    firstName: 'Jane',
    lastName: 'Doe',
    email: 'jane@example.com',
    emailConfirmation: 'jane@example.com',
    companyName: 'Acme',
    businessType: 'B2B',
    street: 'Main',
    houseNumber: '1',
    postalCode: '12345',
    city: 'Berlin',
    country: 'DE',
    vatNumber: 'DE123456789',
    shippingSameAsBilling: true,
    billingContactName: '',
    billingCompanyName: '',
    billingStreet: '',
    billingHouseNumber: '',
    billingPostalCode: '',
    billingCity: '',
    billingCountry: '',
    billingState: '',
    billingPhone: '',
    password: 'Aa12345678',
    passwordConfirmation: 'Aa12345678',
    newsletter: false,
    dealsAlerts: false,
  };

  it('accepts empty billing fields when shippingSameAsBilling is true', () => {
    const result = RegistrationSchema.safeParse(baseValid);
    expect(result.success).toBe(true);
  });

  it('fails required billing fields when shippingSameAsBilling is false', () => {
    const result = RegistrationSchema.safeParse({
      ...baseValid,
      shippingSameAsBilling: false,
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issuesByPath = Object.fromEntries(result.error.issues.map((issue) => [issue.path[0], issue.message]));
      expect(issuesByPath.billingContactName).toBe('register.billingContactName.required');
      expect(issuesByPath.billingStreet).toBe('register.billingStreet.required');
      expect(issuesByPath.billingPostalCode).toBe('register.billingPostalCode.required');
      expect(issuesByPath.billingCity).toBe('register.billingCity.required');
      expect(issuesByPath.billingCountry).toBe('register.billingCountry.required');
      expect(issuesByPath.billingHouseNumber).toBeUndefined();
      expect(issuesByPath.billingState).toBeUndefined();
      expect(issuesByPath.billingPhone).toBeUndefined();
      expect(issuesByPath.billingCompanyName).toBeUndefined();
    }
  });

  it('accepts guest-optional billing fields empty when required billing fields are filled', () => {
    const result = RegistrationSchema.safeParse({
      ...baseValid,
      shippingSameAsBilling: false,
      billingContactName: 'Jane Doe',
      billingStreet: 'Invoice Rd',
      billingPostalCode: '80331',
      billingCity: 'Munich',
      billingCountry: 'DE',
    });
    expect(result.success).toBe(true);
  });

  it('still requires matching emails and passwords', () => {
    const emailMismatch = RegistrationSchema.safeParse({
      ...baseValid,
      emailConfirmation: 'other@example.com',
    });
    expect(emailMismatch.success).toBe(false);
    if (!emailMismatch.success) {
      expect(emailMismatch.error.issues.some((issue) => issue.message === 'register.email.mismatch')).toBe(true);
    }

    const passwordMismatch = RegistrationSchema.safeParse({
      ...baseValid,
      passwordConfirmation: 'Bb12345678',
    });
    expect(passwordMismatch.success).toBe(false);
    if (!passwordMismatch.success) {
      expect(passwordMismatch.error.issues.some((issue) => issue.message === 'register.password.mismatch')).toBe(true);
    }
  });

  it('still requires B2B company name and VAT number', () => {
    const missingCompany = RegistrationSchema.safeParse({
      ...baseValid,
      companyName: '',
    });
    expect(missingCompany.success).toBe(false);
    if (!missingCompany.success) {
      expect(missingCompany.error.issues.some((issue) => issue.message === 'register.companyName.required')).toBe(true);
    }

    const missingVat = RegistrationSchema.safeParse({
      ...baseValid,
      vatNumber: '',
    });
    expect(missingVat.success).toBe(false);
    if (!missingVat.success) {
      expect(missingVat.error.issues.some((issue) => issue.message === 'register.vatNumber.required')).toBe(true);
    }
  });

  it('does not require company name or VAT for B2C', () => {
    const result = RegistrationSchema.safeParse({
      ...baseValid,
      businessType: 'B2C',
      companyName: '',
      vatNumber: '',
    });
    expect(result.success).toBe(true);
  });
});
