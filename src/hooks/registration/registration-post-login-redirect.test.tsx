import { fireEvent, render, waitFor } from '@testing-library/react';
import Registration from '@/components/register/registration';

jest.mock('@/components/ui/link', () => ({
  __esModule: true,
  default: ({ children, href }: { children: React.ReactNode; href?: string }) => <a href={href}>{children}</a>,
}));

const mockLogin = jest.fn();
const mockRegister = jest.fn();

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

const MOCK_REGISTRATION_VALUES = {
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
  vatNumber: '',
  shippingSameAsBilling: true,
  password: 'Secret1ab',
  passwordConfirmation: 'Secret1ab',
  additionalInformation: '',
  newsletter: false,
  dealsAlerts: false,
};

jest.mock('@/hooks/validation/useValidator', () => ({
  useValidator: () => ({
    form: {
      control: {},
      handleSubmit: (onValid: (data: typeof MOCK_REGISTRATION_VALUES) => void | Promise<void>) => () => {
        void onValid(MOCK_REGISTRATION_VALUES);
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
  getLogger: () => ({ warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn() }),
}));

jest.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: () =>
    Object.assign((key: string) => key, {
      rich: () => null,
    }),
}));

describe('Registration post-register redirect (COP-4852)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue({ success: true });
    mockLogin.mockResolvedValue(true);
  });

  it('calls login with home callback after successful register', async () => {
    render(<Registration />);

    const form = document.getElementById('register-form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledTimes(1);
      expect(mockLogin).toHaveBeenCalledWith('jane@example.com', 'Secret1ab', '/');
    });
  });
});
