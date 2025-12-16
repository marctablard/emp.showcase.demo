'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useValidator } from '@/hooks/validation/useValidator';
import { changeCustomerPassword } from '@/lib/client/customer';
import { cn } from '@/lib/utils';
import { PasswordChangeDto } from '@/platform/services/customer/CustomerService';
import { Customer } from '@/platform/services/model/customer/customer';

interface PasswordChangeFormProps {
  customer: Customer | null;
  className?: string;
}

type PasswordFormData = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function PasswordChangeForm({ customer, className }: PasswordChangeFormProps) {
  const t = useTranslations('account');
  const router = useRouter();

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initial data for password change form
  const initialData: PasswordFormData = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  };

  // Use the validator hook with the password validation service
  const { form } = useValidator('PasswordValidationService', initialData, 'onChange');

  const onSubmit = async (data: PasswordFormData) => {
    setError(null);

    if (!customer) {
      setError(t('mustBeLoggedIn') || 'Sie müssen angemeldet sein, um Ihr Passwort zu ändern.');
      return;
    }

    setIsLoading(true);

    try {
      const passwordData: PasswordChangeDto = {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      };

      await changeCustomerPassword(passwordData);
      setSuccess(true);

      // Reset form
      form.reset();

      // Redirect back to account page after 2 seconds
      setTimeout(() => {
        router.push('/account');
      }, 2000);
    } catch (err) {
      if (err instanceof Error) {
        // Check specific error messages
        if (err.message.includes('401') || err.message.includes('Unauthorized') || err.message.includes('incorrect')) {
          setError(t('incorrectPassword') || 'Das aktuelle Passwort ist nicht korrekt.');
        } else {
          setError(`${t('passwordChangeError') || 'Fehler beim Ändern des Passworts'}: ${err.message}`);
        }
      } else {
        setError(t('unknownError') || 'Ein unbekannter Fehler ist aufgetreten.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!customer) {
    return (
      <Alert>
        <AlertDescription>
          {t('mustBeLoggedIn') || 'Sie müssen angemeldet sein, um Ihr Passwort zu ändern.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className={cn('', className)}>
      <CardContent className="py-6">
        {success ? (
          <Alert className="bg-surface-success border-border-success">
            <AlertDescription className="text-text-body">
              {t('passwordChangeSuccess') ||
                'Ihr Passwort wurde erfolgreich geändert. Sie werden zur Kontoübersicht weitergeleitet...'}
            </AlertDescription>
          </Alert>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t('Password.form.currentPasswordLabel') || 'Current Password'}</Label>
              <Input
                id="currentPassword"
                type="password"
                {...form.register('currentPassword')}
                className={form.formState.errors.currentPassword ? 'border-border-error' : ''}
              />
              {form.formState.errors.currentPassword && (
                <p className="text-sm text-text-error mt-1">
                  {t('Password.form.currentPassword.required') || 'Bitte geben Sie Ihr aktuelles Passwort ein.'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">{t('Password.form.newPasswordLabel') || 'New Password'}</Label>
              <Input
                id="newPassword"
                type="password"
                {...form.register('newPassword')}
                className={form.formState.errors.newPassword ? 'border-border-error' : ''}
              />
              {form.formState.errors.newPassword && (
                <p className="text-sm text-text-error mt-1">
                  {form.formState.errors.newPassword.message === 'password.newPassword.minLength'
                    ? t('Password.form.newPassword.minLength') || 'Das Passwort muss mindestens 8 Zeichen lang sein.'
                    : form.formState.errors.newPassword.message === 'password.newPassword.lowercase'
                      ? t('Password.form.newPassword.lowercase') ||
                        'Das Passwort muss mindestens einen Kleinbuchstaben enthalten.'
                      : form.formState.errors.newPassword.message === 'password.newPassword.uppercase'
                        ? t('Password.form.newPassword.uppercase') ||
                          'Das Passwort muss mindestens einen Großbuchstaben enthalten.'
                        : form.formState.errors.newPassword.message === 'password.newPassword.number'
                          ? t('Password.form.newPassword.number') ||
                            'Das Passwort muss mindestens eine Ziffer enthalten.'
                          : t('Password.form.newPassword.required') || 'Bitte geben Sie ein neues Passwort ein.'}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">
                {t('Password.form.confirmPasswordLabel') || 'Confirm New Password'}
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                {...form.register('confirmPassword')}
                className={form.formState.errors.confirmPassword ? 'border-border-error' : ''}
              />
              {form.formState.errors.confirmPassword && (
                <p className="text-sm text-text-error mt-1">
                  {form.formState.errors.confirmPassword.message === 'Password.form.confirmPassword.mismatch'
                    ? t('Password.form.confirmPassword.mismatch') || 'The passwords do not match.'
                    : t('Password.form.confirmPassword.required') || 'Please confirm your password.'}
                </p>
              )}
            </div>

            <div className="flex justify-end pt-4">
              <Button type="submit" disabled={isLoading || Object.keys(form.formState.errors).length > 0}>
                {isLoading
                  ? t('Password.form.saving') || 'Wird gespeichert...'
                  : t('Password.form.changePasswordLabel') || 'Passwort ändern'}
              </Button>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
