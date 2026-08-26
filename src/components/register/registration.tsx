'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { H1, H2 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { ToastType, notify } from '@/components/ui/toast-notification';
import useAuthentication from '@/hooks/authentication/useAuthentication';
import { useRegistration } from '@/hooks/registration/useRegistration';
import useCurrency from '@/hooks/useCurrency';
import { useValidator } from '@/hooks/validation/useValidator';
import { useRouter } from '@/i18n/navigation';
import { redirectToLoginSuccess } from '@/lib/client/auth-login-success-redirect';
import { createCustomerAddress, updateCustomerAddress } from '@/lib/client/customer';
import { ADDRESS_TYPE } from '@/lib/common/address-type-constants';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { RegistrationData } from '@/lib/validation/form-schemas';
import type { CustomerAddress } from '@/platform/services/model/customer/customer';
import { Spinner } from '../ui/spinner';
import { AccountSettingsSection } from './account-settings-section';
import { AddressInfoSection } from './address-info-section';
import { EmailSignupSection } from './email-signup-section';
import { RegistrationInfoSection } from './registration-info-section';

const POST_REGISTER_REDIRECT_PATH = '/';

type RegistrationErrorMessageKey =
  'validation.usernameTaken' | 'validation.emailExists' | 'validation.serverError' | 'validation.registrationFailed';

function registrationErrorMessageKey(error: string | undefined): RegistrationErrorMessageKey {
  switch (error) {
    case 'USERNAME_TAKEN':
      return 'validation.usernameTaken';
    case 'EMAIL_EXISTS':
      return 'validation.emailExists';
    case 'SERVER_ERROR':
      return 'validation.serverError';
    default:
      return 'validation.registrationFailed';
  }
}

function unknownErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Failed to persist billing address after registration';
}

function buildRegisterRequest(values: RegistrationData, locale: string, currencyCode: string | undefined) {
  const addressTags = values.shippingSameAsBilling
    ? [ADDRESS_TYPE.SHIPPING, ADDRESS_TYPE.BILLING]
    : [ADDRESS_TYPE.SHIPPING];

  return {
    credentials: {
      username: values.email,
      password: values.password,
    },
    customer: {
      email: values.email,
      firstName: values.firstName,
      lastName: values.lastName,
      company: values.companyName,
      language: locale,
      currency: currencyCode,
    },
    address: {
      contactName: values.firstName + ' ' + values.lastName,
      companyName: values.companyName,
      street: values.street,
      streetNumber: values.houseNumber,
      city: values.city,
      zipCode: values.postalCode,
      country: values.country,
      tags: addressTags,
      source: 'customer' as const,
    },
  };
}

function toBillingCustomerAddress(values: RegistrationData): CustomerAddress {
  return {
    contactName: values.billingContactName || '',
    companyName: values.billingCompanyName,
    street: values.billingStreet || '',
    streetNumber: values.billingHouseNumber,
    zipCode: values.billingPostalCode || '',
    city: values.billingCity || '',
    country: values.billingCountry || '',
    state: values.billingState,
    contactPhone: values.billingPhone,
    tags: [ADDRESS_TYPE.BILLING],
    source: 'customer',
  };
}

async function persistBillingAddressAfterLogin(
  values: RegistrationData,
): Promise<{ ok: true } | { ok: false; errorMessage: string }> {
  try {
    const createdBillingAddress = await createCustomerAddress(toBillingCustomerAddress(values));
    if (!createdBillingAddress.id) {
      return { ok: false, errorMessage: 'Created billing address is missing id' };
    }

    const updatedBillingAddress = await updateCustomerAddress(createdBillingAddress.id, {
      ...createdBillingAddress,
      isDefault: true,
    });

    if (updatedBillingAddress?.isDefault === true) {
      return { ok: true };
    }
    return { ok: false, errorMessage: 'Billing address isDefault was not persisted' };
  } catch (billingError) {
    return { ok: false, errorMessage: unknownErrorMessage(billingError) };
  }
}

export default function Registration() {
  const t = useTranslations('auth.register');

  const { loading: loginLoading, login } = useAuthentication();
  const { register, loading, error } = useRegistration();
  const [formError, setFormError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const { currency } = useCurrency();
  const router = useRouter();

  useEffect(() => {
    if (formError && top.current) {
      top.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [formError]);

  // Use the validator hook with the RegistrationValidationService
  const { form } = useValidator(
    'RegistrationValidationService',
    {
      firstName: '',
      lastName: '',
      email: '',
      emailConfirmation: '',
      companyName: '',
      businessType: 'B2B',
      street: '',
      houseNumber: '',
      postalCode: '',
      city: '',
      country: '',
      vatNumber: '',
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
      password: '',
      passwordConfirmation: '',
      additionalInformation: '',
      newsletter: false,
      dealsAlerts: false,
    },
    'onChange',
  );

  function notifyBillingAddressFailed(errorMessage: string) {
    notify({
      type: ToastType.Error,
      title: t('validation.billingAddressFailed', { errorMessage }),
      duration: 5000,
    });
    router.push('/account/addresses');
  }

  async function completePostRegister(values: RegistrationData) {
    if (values.shippingSameAsBilling) {
      const signedIn = await login(values.email, values.password, POST_REGISTER_REDIRECT_PATH);
      if (!signedIn) {
        setFormError(t('validation.signInAfterRegisterFailed'));
      }
      return;
    }

    const signedIn = await login(values.email, values.password);
    if (!signedIn) {
      setFormError(t('validation.signInAfterRegisterFailed'));
      return;
    }

    const persistResult = await persistBillingAddressAfterLogin(values);
    if (persistResult.ok) {
      await redirectToLoginSuccess(POST_REGISTER_REDIRECT_PATH, locale);
      return;
    }

    getLogger().error({ error: persistResult.errorMessage }, 'Failed to persist billing address after registration');
    notifyBillingAddressFailed(persistResult.errorMessage);
  }

  async function onSubmit(values: RegistrationData) {
    setFormError(null);
    setProcessing(true);

    try {
      const result = await register(buildRegisterRequest(values, locale, currency?.code));
      if (!result.success) {
        if (result.error) {
          getLogger().warn({ error: result.error }, 'Registration error');
          setFormError(t(registrationErrorMessageKey(result.error)));
        }
        return;
      }
      await completePostRegister(values);
    } catch (error) {
      getLogger().error({ err: error }, 'Registration error');
      setFormError(t('validation.registrationFailed'));
    } finally {
      setProcessing(false);
    }
  }

  if (loading || loginLoading || processing) {
    return (
      <div className="mx-4 md:mx-9">
        <div className="flex gap-3 align-end mb-8">
          <H1 variant="h4">{t('title')}</H1>
        </div>
        <div className="flex flex-col items-center justify-center py-12">
          <Spinner variant="lg" />
        </div>
      </div>
    );
  }
  return (
    <div
      className="w-[calc(100%-2rem)] mx-auto max-w-[485px] md:max-w-[790px] lg:max-w-228 px-6 pb-32 pt-6 sm:pt-0 flex flex-col gap-8"
      ref={top}
    >
      <div className="flex flex-col gap-2">
        <H1 variant="h4">{t('title')}</H1>
        <p>
          {t('alreadyHaveAccount')}{' '}
          <UiLink type="Link" href="/login?callbackUrl=/account">
            {t('logIn')}
          </UiLink>
        </p>
      </div>

      <Form {...form}>
        <form id="register-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-8">
          {(formError || error) && (
            <div className="flex flex-col gap-2">
              <H2 variant="h5" className="text-text-error">
                {t('error')}
              </H2>
              <span className="text-text-error">{formError || error}</span>
            </div>
          )}

          <RegistrationInfoSection number={1} control={form.control} />
          <AddressInfoSection number={2} control={form.control} />
          <AccountSettingsSection number={3} control={form.control} />
          {/* Todo: Add additional information section */}
          {/*<AdditionalInformationSection number={4} control={form.control} />*/}
          <EmailSignupSection number={4} control={form.control} />
        </form>
      </Form>

      <div className="flex flex-col items-start gap-6">
        <p>
          {t.rich('termsNotice', {
            privacyPolicy: (chunks) => (
              <UiLink type="Link" href="/privacy-policy">
                {chunks}
              </UiLink>
            ),
            termsOfUse: (chunks) => (
              <UiLink type="Link" href="/terms-and-conditions">
                {chunks}
              </UiLink>
            ),
          })}
        </p>
        <Button
          type="submit"
          form="register-form"
          className="w-full"
          disabled={loading || processing || !form.formState.isValid}
          data-testid="register-submitButton"
        >
          {loading ? t('registering') : t('registerButton')}
        </Button>
        <p>
          {t('alreadyHaveAccount')}{' '}
          <UiLink type="Link" href="/login?callbackUrl=/account">
            {t('logIn')}
          </UiLink>
        </p>
      </div>
    </div>
  );
}
