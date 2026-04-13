'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { H1, H2 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import useAuthentication from '@/hooks/authentication/useAuthentication';
import { useRegistration } from '@/hooks/registration/useRegistration';
import useCurrency from '@/hooks/useCurrency';
import { useValidator } from '@/hooks/validation/useValidator';
import { getLogger } from '@/lib/logger/use-logger-client';
import { RegistrationData } from '@/platform/services/validation/impl/EmporixRegistrationValidationService';
import { Spinner } from '../ui/spinner';
import { AccountSettingsSection } from './account-settings-section';
import { AddressInfoSection } from './address-info-section';
import { EmailSignupSection } from './email-signup-section';
import { RegistrationInfoSection } from './registration-info-section';

const POST_REGISTER_REDIRECT_PATH = '/';

export default function Registration() {
  const t = useTranslations('auth.register');

  const { loading: loginLoading, login } = useAuthentication();
  const { register, loading, error } = useRegistration();
  const [formError, setFormError] = useState<string | null>(null);
  const top = useRef<HTMLDivElement>(null);
  const locale = useLocale();
  const { currency } = useCurrency();

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
      password: '',
      passwordConfirmation: '',
      additionalInformation: '',
      newsletter: false,
      dealsAlerts: false,
    },
    'onChange',
  );

  async function onSubmit(values: RegistrationData) {
    setFormError(null);

    try {
      const result = await register({
        credentials: {
          username: values.email,
          password: values.password,
        },
        customer: {
          email: values.email,
          firstName: values.firstName,
          lastName: values.lastName,
          company: values.companyName,
          language: locale, // use current locale
          currency: currency?.code, // use current currency
        },
        address: {
          contactName: values.firstName + ' ' + values.lastName,
          street: values.street,
          streetNumber: values.houseNumber,
          city: values.city,
          zipCode: values.postalCode,
          country: values.country,
          tags: ['SHIPPING', 'BILLING'],
        },
      });

      if (result.success) {
        const signedIn = await login(values.email, values.password, POST_REGISTER_REDIRECT_PATH);
        if (!signedIn) {
          setFormError(t('validation.signInAfterRegisterFailed'));
        }
      } else if (result.error) {
        getLogger().warn({ error: result.error }, 'Registration error');
        // Handle specific error types
        // Todo: Check below cases if they exist
        switch (result.error) {
          case 'USERNAME_TAKEN':
            setFormError(t('validation.usernameTaken'));
            break;
          case 'EMAIL_EXISTS':
            setFormError(t('validation.emailExists'));
            break;
          case 'SERVER_ERROR':
            setFormError(t('validation.serverError'));
            break;
          default:
            setFormError(t('validation.registrationFailed'));
        }
      }
    } catch (error) {
      getLogger().error({ err: error }, 'Registration error');
      setFormError(t('validation.registrationFailed'));
    }
  }

  if (loading || loginLoading) {
    return (
      <div className="mx-4 lg:mx-9">
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
    <div className="w-full max-w-228 px-6 pb-32 pt-6 sm:pt-0 flex flex-col gap-8" ref={top}>
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
          disabled={loading || !form.formState.isValid}
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
