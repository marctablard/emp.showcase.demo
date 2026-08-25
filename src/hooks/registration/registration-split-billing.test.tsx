/**
 * @jest-environment jsdom
 */
import React from 'react';
import '@testing-library/jest-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import Registration from '@/components/register/registration';
import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';

window.HTMLElement.prototype.scrollIntoView = jest.fn();

jest.mock('@/components/ui/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href?: string }) => <a href={href}>{children}</a>,
}));

const mockLogin = jest.fn();
const mockRegister = jest.fn();
const mockRouterPush = jest.fn();
const mockCreateCustomerAddress = jest.fn();
const mockUpdateCustomerAddress = jest.fn();
const mockRedirectToLoginSuccess = jest.fn();
const mockNotify = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/hooks/authentication/useAuthentication', () => ({
  __esModule: true,
  default: () => ({
    login: (...args: unknown[]) => mockLogin(...args),
    loading: false,
  }),
}));

jest.mock('@/hooks/registration/useRegistration', () => ({
  useRegistration: () => ({
    register: mockRegister,
    loading: false,
    error: null,
  }),
}));

jest.mock('@/hooks/useCurrency', () => ({
  __esModule: true,
  default: () => ({ currency: { code: 'EUR' } }),
}));

jest.mock('@/i18n/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

jest.mock('@/lib/client/customer', () => ({
  createCustomerAddress: (...args: unknown[]) => mockCreateCustomerAddress(...args),
  updateCustomerAddress: (...args: unknown[]) => mockUpdateCustomerAddress(...args),
}));

jest.mock('@/lib/client/auth-login-success-redirect', () => ({
  redirectToLoginSuccess: (...args: unknown[]) => mockRedirectToLoginSuccess(...args),
}));

jest.mock('@/components/ui/toast-notification', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
  ToastType: { Error: 'error', Success: 'success' },
}));

let mockFormValues: Record<string, unknown> = {};

const BASE_REGISTRATION_VALUES = {
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane@example.com',
  emailConfirmation: 'jane@example.com',
  companyName: 'Acme',
  businessType: 'B2B' as const,
  street: 'Main',
  houseNumber: '1',
  postalCode: '12345',
  city: 'Berlin',
  country: 'DE',
  vatNumber: 'DE123',
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
  additionalInformation: '',
  newsletter: false,
  dealsAlerts: false,
};

const UNCHECKED_BILLING_VALUES = {
  shippingSameAsBilling: false,
  billingContactName: 'Billing Contact',
  billingCompanyName: 'Billing Co',
  billingStreet: 'Billing St',
  billingHouseNumber: '99',
  billingPostalCode: '54321',
  billingCity: 'Munich',
  billingCountry: 'DE',
  billingState: 'BY',
  billingPhone: '555-0100',
};

const CREATED_BILLING_ADDRESS = {
  id: 'addr-billing-1',
  contactName: 'Billing Contact',
  companyName: 'Billing Co',
  street: 'Billing St',
  streetNumber: '99',
  zipCode: '54321',
  city: 'Munich',
  country: 'DE',
  state: 'BY',
  contactPhone: '555-0100',
  tags: [ADDRESS_TYPE.BILLING],
  source: 'customer' as const,
};

jest.mock('@/hooks/validation/useValidator', () => ({
  useValidator: () => ({
    form: {
      control: {},
      handleSubmit: (onValid: (data: typeof BASE_REGISTRATION_VALUES) => void | Promise<void>) => () => {
        void onValid({ ...BASE_REGISTRATION_VALUES, ...mockFormValues });
      },
      formState: { isValid: true },
    },
  }),
}));

jest.mock('@/components/register/registration-info-section', () => ({
  RegistrationInfoSection: () => null,
}));
jest.mock('@/components/register/address-info-section', () => ({
  AddressInfoSection: () => null,
}));
jest.mock('@/components/register/account-settings-section', () => ({
  AccountSettingsSection: () => null,
}));
jest.mock('@/components/register/email-signup-section', () => ({
  EmailSignupSection: () => null,
}));

jest.mock('@/components/ui/form', () => ({
  Form: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/logger/use-logger-client', () => ({
  getLogger: () => ({ warn: jest.fn(), error: mockLoggerError, info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () =>
    Object.assign(
      (key: string, values?: { errorMessage?: string }) => {
        if (values?.errorMessage) {
          return `${key}:${values.errorMessage}`;
        }
        return key;
      },
      {
        rich: () => null,
      },
    ),
}));

function submitRegistration() {
  render(<Registration />);
  const form = document.getElementById('register-form');
  expect(form).not.toBeNull();
  fireEvent.submit(form!);
}

describe('Registration split billing submit (COP-4861)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue({ success: true });
    mockLogin.mockResolvedValue(true);
    mockRedirectToLoginSuccess.mockResolvedValue(undefined);
    mockFormValues = {};
  });

  it('sends dual SHIPPING and BILLING tags and does not create or update addresses when checkbox is checked', async () => {
    mockFormValues = { shippingSameAsBilling: true };

    submitRegistration();

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });

    const registerCall = mockRegister.mock.calls[0][0];
    expect(registerCall.address.tags).toEqual([ADDRESS_TYPE.SHIPPING, ADDRESS_TYPE.BILLING]);
    expect(mockLogin).toHaveBeenCalledWith('jane@example.com', 'Aa12345678', '/');
    expect(mockCreateCustomerAddress).not.toHaveBeenCalled();
    expect(mockUpdateCustomerAddress).not.toHaveBeenCalled();
    expect(mockRedirectToLoginSuccess).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  it('sends signup tags SHIPPING only when checkbox is unchecked', async () => {
    mockFormValues = UNCHECKED_BILLING_VALUES;
    mockCreateCustomerAddress.mockResolvedValue(CREATED_BILLING_ADDRESS);
    mockUpdateCustomerAddress.mockResolvedValue({ ...CREATED_BILLING_ADDRESS, isDefault: true });

    submitRegistration();

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
    });

    const registerCall = mockRegister.mock.calls[0][0];
    expect(registerCall.address.tags).toEqual([ADDRESS_TYPE.SHIPPING]);
  });

  it('calls login without callbackUrl then createCustomerAddress and updateCustomerAddress with isDefault true', async () => {
    mockFormValues = UNCHECKED_BILLING_VALUES;
    mockCreateCustomerAddress.mockResolvedValue(CREATED_BILLING_ADDRESS);
    mockUpdateCustomerAddress.mockResolvedValue({ ...CREATED_BILLING_ADDRESS, isDefault: true });

    submitRegistration();

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('jane@example.com', 'Aa12345678');
      expect(mockCreateCustomerAddress).toHaveBeenCalledTimes(1);
      expect(mockUpdateCustomerAddress).toHaveBeenCalledTimes(1);
    });

    expect(mockCreateCustomerAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        contactName: 'Billing Contact',
        companyName: 'Billing Co',
        street: 'Billing St',
        streetNumber: '99',
        zipCode: '54321',
        city: 'Munich',
        country: 'DE',
        state: 'BY',
        contactPhone: '555-0100',
        tags: [ADDRESS_TYPE.BILLING],
        source: 'customer',
      }),
    );
    expect(mockUpdateCustomerAddress).toHaveBeenCalledWith(
      'addr-billing-1',
      expect.objectContaining({ isDefault: true }),
    );
  });

  it('calls home /?login=success helper only when billing address is default after PATCH', async () => {
    mockFormValues = UNCHECKED_BILLING_VALUES;
    mockCreateCustomerAddress.mockResolvedValue(CREATED_BILLING_ADDRESS);
    mockUpdateCustomerAddress.mockResolvedValue({ ...CREATED_BILLING_ADDRESS, isDefault: true });

    submitRegistration();

    await waitFor(() => {
      expect(mockRedirectToLoginSuccess).toHaveBeenCalledWith('/', 'en');
    });

    expect(mockRouterPush).not.toHaveBeenCalled();
    expect(mockNotify).not.toHaveBeenCalled();
  });

  it('notifies and immediately pushes /account/addresses when billing create fails, without 3000ms delay', async () => {
    mockFormValues = UNCHECKED_BILLING_VALUES;
    mockCreateCustomerAddress.mockRejectedValue(new Error('Network error'));

    submitRegistration();

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'validation.billingAddressFailed:Network error',
        }),
      );
      expect(mockRouterPush).toHaveBeenCalledWith('/account/addresses');
    });

    expect(mockUpdateCustomerAddress).not.toHaveBeenCalled();
    expect(mockRedirectToLoginSuccess).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      { error: 'Network error' },
      'Failed to persist billing address after registration',
    );
  });

  it('does not call the success helper when isDefault stays false after PATCH', async () => {
    mockFormValues = UNCHECKED_BILLING_VALUES;
    mockCreateCustomerAddress.mockResolvedValue(CREATED_BILLING_ADDRESS);
    mockUpdateCustomerAddress.mockResolvedValue({ ...CREATED_BILLING_ADDRESS, isDefault: false });

    submitRegistration();

    await waitFor(() => {
      expect(mockUpdateCustomerAddress).toHaveBeenCalledWith(
        'addr-billing-1',
        expect.objectContaining({ isDefault: true }),
      );
      expect(mockNotify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
        }),
      );
      expect(mockRouterPush).toHaveBeenCalledWith('/account/addresses');
    });

    expect(mockRedirectToLoginSuccess).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      { error: 'Billing address isDefault was not persisted' },
      'Failed to persist billing address after registration',
    );
  });

  it('stays on the form with an inline error when customer create fails', async () => {
    mockFormValues = { shippingSameAsBilling: true };
    mockRegister.mockResolvedValue({ success: false, error: 'EMAIL_EXISTS' });

    submitRegistration();

    await waitFor(() => {
      expect(screen.getByText('validation.emailExists')).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
    expect(mockCreateCustomerAddress).not.toHaveBeenCalled();
    expect(mockUpdateCustomerAddress).not.toHaveBeenCalled();
    expect(mockRedirectToLoginSuccess).not.toHaveBeenCalled();
    expect(mockRouterPush).not.toHaveBeenCalled();
  });
});
