import { AddressFormSchema, ProfileEditSchema } from './form-schemas';

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

describe('ProfileEditSchema - phone validation', () => {
  const baseProfile = {
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    preferredLanguage: 'en',
    preferredCurrency: 'EUR',
  };

  it.each([
    ['empty string', ''],
    ['undefined', undefined],
    ['+49 123 456 7890 (standard international)', '+49 123 456 7890'],
    ['004912345678901 (15 digits with 00 prefix)', '004912345678901'],
    ['+1234567 (minimum 7 digits)', '+1234567'],
    ['(0)123-456-7890 (parens/dashes)', '(0)123-456-7890'],
    ['+49.123.456.7890 (dots)', '+49.123.456.7890'],
  ])('accepts %s', (_label, phone) => {
    const result = ProfileEditSchema.safeParse({ ...baseProfile, phone });
    expect(result.success).toBe(true);
  });

  it.each([
    ['123456 (too short - 6 digits)', '123456'],
    ['+1234567890123456 (16 real digits)', '+1234567890123456'],
    ['+49-abc-1234 (contains letters)', '+49-abc-1234'],
    ['!@#$% (special characters)', '!@#$%'],
    ['++49 1234567 (multiple plus signs)', '++49 1234567'],
    ['12)34(5678 (misplaced parentheses)', '12)34(56789'],
    ['1234(567 (unbalanced open paren)', '1234(567890'],
    ['+49+ 1234567 (plus not only at start)', '+49+ 1234567'],
  ])('rejects %s', (_label, phone) => {
    const result = ProfileEditSchema.safeParse({ ...baseProfile, phone });
    expect(result.success).toBe(false);
    if (!result.success) {
      const messages = result.error.issues.map((issue) => issue.message);
      expect(messages).toContain('profile.form.phone.invalid');
    }
  });
});
