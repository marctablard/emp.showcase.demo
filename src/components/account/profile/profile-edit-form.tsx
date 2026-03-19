'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useValidator } from '@/hooks/validation/useValidator';
import { updateCustomerProfile } from '@/lib/client/customer';
import { CustomerUpdateDto } from '@/platform/services/customer/CustomerService';
import { Customer } from '@/platform/services/model/customer/customer';

interface ProfileEditFormProps {
  customer: Customer | null;
}

type ProfileFormData = {
  title: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  preferredLanguage: string;
  preferredCurrency: string;
};

const TITLE_KEYS = ['MR', 'MRS', 'MS'] as const;
const LANGUAGES = ['de', 'en'] as const;
const CURRENCIES = ['EUR', 'USD', 'GBP'];

export default function ProfileEditForm({ customer }: ProfileEditFormProps) {
  const t = useTranslations('account');
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initial data for profile form
  const initialData: ProfileFormData = {
    title: customer?.title || '',
    firstName: customer?.firstName || '',
    lastName: customer?.lastName || '',
    email: customer?.email || '',
    phone: customer?.contactPhone || '',
    preferredLanguage: customer?.language || 'de',
    preferredCurrency: customer?.currency || 'EUR',
  };

  // Use the validator hook with the profile validation service
  const { form } = useValidator('ProfileValidationService', initialData, 'onChange');

  const onSubmit = async (data: ProfileFormData) => {
    setError(null);

    if (!customer) {
      setError(t('profile.mustBeLoggedIn') || 'Sie müssen angemeldet sein, um Ihr Profil zu bearbeiten.');
      return;
    }

    setIsLoading(true);

    try {
      const profileData: CustomerUpdateDto = {
        title: data.title,
        firstName: data.firstName,
        lastName: data.lastName,
        contactEmail: data.email,
        contactPhone: data.phone,
        preferredLanguage: data.preferredLanguage,
        preferredCurrency: data.preferredCurrency,
      };

      await updateCustomerProfile(profileData);
      setSuccess(true);

      // Refresh the page after 1.5 seconds to show updated data
      setTimeout(() => {
        router.refresh();
      }, 1500);
    } catch (err) {
      if (err instanceof Error) {
        setError(`${t('profile.form.updateError') || 'Fehler beim Aktualisieren des Profils'}: ${err.message}`);
      } else {
        setError(t('profile.form.unknownError') || 'Ein unbekannter Fehler ist aufgetreten.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!customer) {
    return (
      <Alert>
        <AlertDescription>
          {t('profile.mustBeLoggedIn') || 'Sie müssen angemeldet sein, um Ihr Profil zu bearbeiten.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('profile.title') || 'Profileinstellungen'}</CardTitle>
        <CardDescription>{t('profile.description') || 'Aktualisieren Sie Ihre persönlichen Daten'}</CardDescription>
      </CardHeader>
      <CardContent>
        {success ? (
          <Alert className="bg-surface-success border-border-success mb-4">
            <AlertDescription className="text-text-body">
              {t('profile.form.updateSuccess') || 'Ihre Profildaten wurden erfolgreich aktualisiert.'}
            </AlertDescription>
          </Alert>
        ) : null}

        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t('profile.form.titleLabel') || 'Anrede'}</Label>
              <Select defaultValue={initialData.title} onValueChange={(value) => form.setValue('title', value)}>
                <SelectTrigger
                  id="title"
                  className={form.formState.errors.title ? 'border-border-error' : ''}
                  data-testid="profile-title"
                >
                  <SelectValue placeholder={t('profile.form.selectTitle') || 'Anrede auswählen'} />
                </SelectTrigger>
                <SelectContent>
                  {TITLE_KEYS.map((titleKey) => (
                    <SelectItem key={titleKey} value={titleKey}>
                      {t(`profile.form.titles.${titleKey}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Spacer for alignment with two columns */}
            <div className="hidden sm:block"></div>

            {/* First Name */}
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('profile.form.firstNameLabel') || 'Vorname'}</Label>
              <Input
                id="firstName"
                type="text"
                {...form.register('firstName')}
                className={form.formState.errors.firstName ? 'border-border-error' : ''}
                data-testid="profile-firstName"
              />
              {form.formState.errors.firstName && (
                <p className="text-sm text-text-error mt-1">
                  {t('profile.form.firstName.required') || 'Bitte geben Sie Ihren Vornamen ein.'}
                </p>
              )}
            </div>

            {/* Last Name */}
            <div className="space-y-2">
              <Label htmlFor="lastName">{t('profile.form.lastNameLabel') || 'Nachname'}</Label>
              <Input
                id="lastName"
                type="text"
                {...form.register('lastName')}
                className={form.formState.errors.lastName ? 'border-border-error' : ''}
                data-testid="profile-lastName"
              />
              {form.formState.errors.lastName && (
                <p className="text-sm text-text-error mt-1">
                  {t('profile.form.lastName.required') || 'Bitte geben Sie Ihren Nachnamen ein.'}
                </p>
              )}
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">{t('profile.form.emailLabel') || 'E-Mail'}</Label>
              <Input
                id="email"
                type="email"
                {...form.register('email')}
                className={form.formState.errors.email ? 'border-border-error' : ''}
                data-testid="profile-email"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-text-error mt-1">
                  {form.formState.errors.email.message === 'profile.form.email.invalid'
                    ? t('profile.form.email.invalid') || 'Bitte geben Sie eine gültige E-Mail-Adresse ein.'
                    : t('profile.form.email.required') || 'Bitte geben Sie Ihre E-Mail-Adresse ein.'}
                </p>
              )}
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="phone">{t('profile.form.phoneLabel') || 'Telefon'}</Label>
              <Input
                id="phone"
                type="tel"
                {...form.register('phone')}
                className={form.formState.errors.phone ? 'border-border-error' : ''}
                data-testid="profile-phone"
              />
              {form.formState.errors.phone && (
                <p className="text-sm text-text-error mt-1">
                  {t('profile.form.phone.invalid') || 'Bitte geben Sie eine gültige Telefonnummer ein.'}
                </p>
              )}
            </div>

            {/* Preferred Language */}
            <div className="space-y-2">
              <Label htmlFor="preferredLanguage">{t('profile.form.preferredLanguage') || 'Bevorzugte Sprache'}</Label>
              <Select
                defaultValue={initialData.preferredLanguage}
                onValueChange={(value) => form.setValue('preferredLanguage', value)}
              >
                <SelectTrigger
                  id="preferredLanguage"
                  className={form.formState.errors.preferredLanguage ? 'border-border-error' : ''}
                  data-testid="profile-preferredLanguage"
                >
                  <SelectValue placeholder={t('profile.form.selectLanguage') || 'Sprache auswählen'} />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((lang) => (
                    <SelectItem key={lang} value={lang}>
                      {t(`profile.form.language.${lang}`) || lang}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Preferred Currency */}
            <div className="space-y-2">
              <Label htmlFor="preferredCurrency">{t('profile.form.preferredCurrency') || 'Bevorzugte Währung'}</Label>
              <Select
                defaultValue={initialData.preferredCurrency}
                onValueChange={(value) => form.setValue('preferredCurrency', value)}
              >
                <SelectTrigger
                  id="preferredCurrency"
                  className={form.formState.errors.preferredCurrency ? 'border-border-error' : ''}
                  data-testid="profile-preferredCurrency"
                >
                  <SelectValue placeholder={t('profile.form.selectCurrency') || 'Währung auswählen'} />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={isLoading || Object.keys(form.formState.errors).length > 0}
              data-testid="profile-saveButton"
            >
              {isLoading
                ? t('profile.form.saving') || 'Wird gespeichert...'
                : t('profile.form.saveProfile') || 'Profil speichern'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
