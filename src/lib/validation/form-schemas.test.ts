import { AddressFormSchema } from './form-schemas';

describe('AddressFormSchema', () => {
  const baseValid = {
    contactName: 'Jane Doe',
    street: 'Main Street',
    streetNumber: '10',
    zipCode: '10115',
    city: 'Berlin',
    country: 'DE',
  };

  it('accepts an empty string for streetNumber', () => {
    const result = AddressFormSchema.safeParse({ ...baseValid, streetNumber: '' });
    expect(result.success).toBe(true);
  });

  it('accepts a missing streetNumber key (optional)', () => {
    const { streetNumber: _omit, ...withoutStreetNumber } = baseValid;
    const result = AddressFormSchema.safeParse(withoutStreetNumber);
    expect(result.success).toBe(true);
  });

  it('still fails when street is empty', () => {
    const result = AddressFormSchema.safeParse({ ...baseValid, street: '', streetNumber: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('address.street.required');
    }
  });

  it('still fails when country is empty', () => {
    const result = AddressFormSchema.safeParse({ ...baseValid, country: '', streetNumber: '' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('address.country.required');
    }
  });

  it('still fails when contactName, zipCode, or city are missing', () => {
    const result = AddressFormSchema.safeParse({
      contactName: '',
      street: 'Main Street',
      streetNumber: '',
      zipCode: '',
      city: '',
      country: 'DE',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toEqual(
        expect.arrayContaining(['address.contactName.required', 'address.zipCode.required', 'address.city.required']),
      );
    }
  });
});
