import React from 'react';
import { useForm } from 'react-hook-form';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { AddressInfoSection } from '@/components/register/address-info-section';
import { Form } from '@/components/ui/form';
import type { RegistrationData } from '@/lib/validation/form-schemas';

jest.mock('@/components/ui/select', () => jest.requireActual('../../../jest/mocks/ui-select'));

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

const EXPECTED_LOCALIZED_COUNTRY_LABELS = ['Austria', 'Germany', 'Zimbabwe'] as const;

jest.mock('@/hooks/site/useSite', () => ({
  useSite: () => ({
    loading: false,
    countries: [
      { code: 'ZW', name: 'Zimbabwe' },
      { code: 'DE', name: 'Germany' },
      { code: 'AT', name: 'Austria' },
    ],
    fetchSiteData: () => undefined,
  }),
}));

jest.mock('@/hooks/useL10n', () => ({
  useL10n: () => ({
    l10n: (value: string | Record<string, string>) => (typeof value === 'string' ? value : (value.en ?? '')),
  }),
}));

const BILLING_TEST_IDS = [
  'register-billing-companyName',
  'register-billing-contactName',
  'register-billing-street',
  'register-billing-streetNumber',
  'register-billing-zipCode',
  'register-billing-city',
  'register-billing-state',
  'register-billing-phoneNumber',
  'register-billing-country',
] as const;

const defaultValues: Partial<RegistrationData> = {
  businessType: 'B2B',
  companyName: '',
  vatNumber: '',
  street: '',
  houseNumber: '',
  postalCode: '',
  city: '',
  country: '',
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
};

function renderSection(overrides: Partial<RegistrationData> = {}) {
  const formRef: { current: ReturnType<typeof useForm<RegistrationData>> | null } = { current: null };

  function Harness() {
    const form = useForm<RegistrationData>({
      defaultValues: { ...defaultValues, ...overrides },
    });
    formRef.current = form;
    return (
      <Form {...form}>
        <AddressInfoSection control={form.control} number={2} />
      </Form>
    );
  }

  return { ...render(<Harness />), formRef };
}

describe('AddressInfoSection billing fields', () => {
  it('does not render billing fields when the checkbox is checked', () => {
    renderSection();

    expect(screen.getByTestId('register-shippingSameAsBilling')).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'auth.register.shippingSameAsBilling' })).toBeInTheDocument();
    expect(screen.getByText('auth.register.addressInfo', { exact: false })).toBeInTheDocument();
    for (const testId of BILLING_TEST_IDS) {
      expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
    }
  });

  it('reveals guest-parity billing fields when the checkbox is unchecked', async () => {
    const { formRef, container } = renderSection();

    fireEvent.click(screen.getByTestId('register-shippingSameAsBilling'));

    await waitFor(() => {
      expect(screen.getByTestId('register-billing-contactName')).toBeInTheDocument();
    });

    for (const testId of BILLING_TEST_IDS) {
      expect(screen.getByTestId(testId)).toBeInTheDocument();
    }

    expect(screen.getByRole('checkbox', { name: 'auth.register.shippingSameAsBilling' })).toBeInTheDocument();
    expect(screen.getByText('auth.register.billingAddressInfo')).toBeInTheDocument();
    expect(container.querySelector('form')).toBeNull();

    fireEvent.change(screen.getByTestId('register-billing-street'), { target: { value: 'Billing Street' } });
    expect(formRef.current?.getValues('billingStreet')).toBe('Billing Street');
  });

  it('uses account.AddressForm labels for billing contact, state, and phone', async () => {
    renderSection({ shippingSameAsBilling: false });

    expect(screen.getByLabelText('account.AddressForm.fullName*')).toHaveAttribute(
      'data-testid',
      'register-billing-contactName',
    );
    expect(screen.getByLabelText('account.AddressForm.state')).toHaveAttribute('data-testid', 'register-billing-state');
    expect(screen.getByLabelText('account.AddressForm.phoneNumber')).toHaveAttribute(
      'data-testid',
      'register-billing-phoneNumber',
    );
  });

  it('lists shipping and billing country options in localized-name order', async () => {
    renderSection();

    const shippingRoot = screen.getByTestId('register-country').closest('[data-slot="select"]');
    expect(shippingRoot).not.toBeNull();
    const shippingOptions = within(shippingRoot as HTMLElement).getAllByRole('option');
    expect(shippingOptions.map((option) => option.textContent)).toEqual([...EXPECTED_LOCALIZED_COUNTRY_LABELS]);

    fireEvent.click(screen.getByTestId('register-shippingSameAsBilling'));
    await waitFor(() => {
      expect(screen.getByTestId('register-billing-country')).toBeInTheDocument();
    });

    const billingRoot = screen.getByTestId('register-billing-country').closest('[data-slot="select"]');
    expect(billingRoot).not.toBeNull();
    const billingOptions = within(billingRoot as HTMLElement).getAllByRole('option');
    expect(billingOptions.map((option) => option.textContent)).toEqual([...EXPECTED_LOCALIZED_COUNTRY_LABELS]);
  });
});
