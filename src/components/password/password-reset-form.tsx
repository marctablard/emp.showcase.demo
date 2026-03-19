'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { H1 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useValidator } from '@/hooks/validation/useValidator';

type PasswordResetFormProps = {
  email?: string;
  callbackUrl?: string;
  onSuccess?: () => void;
  isDialog?: boolean;
};

export function PasswordResetForm({ email, callbackUrl, onSuccess, isDialog = false }: PasswordResetFormProps) {
  const t = useTranslations('auth.Password');

  const { form } = useValidator(
    'PasswordResetValidationService',
    {
      email: email || '',
    },
    'onChange',
  );
  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  // Reset form when email changes
  useEffect(() => {
    if (form) {
      form.reset({ email: email || '' });
    }
  }, [form, email]);

  async function onSubmit(values: { email: string }) {
    await fetch('/api/password-reset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: values.email }),
    });

    notify({
      title: t('resetEmailSent'),
      duration: 5000,
      type: ToastType.Success,
      button: {
        label: t('close'),
        onClick: () => {},
      },
    });

    onSuccess?.();
  }

  const searchParams = useSearchParams();
  email = email ?? searchParams.get('email') ?? undefined;
  // null is fine, just undefined needs to be checked
  if (callbackUrl === undefined) {
    callbackUrl = searchParams.get('callbackUrl') ?? undefined;
  }

  return (
    <div className="flex flex-col gap-6 w-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
          <div className="space-y-1">
            <H1 variant="h4">{t('resetPassword')}</H1>
            <p>{t('resetPasswordDescription')}</p>
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="relative">
                <FormLabel>{t('email')}</FormLabel>
                <FormControl>
                  <Input placeholder="email@example.com" type="email" {...field} data-testid="passwordReset-email" />
                </FormControl>
                <div className="absolute top-full left-0 mt-0.5">
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />

          <div className="flex flex-col gap-6 w-full items-center">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !isValid}
              data-testid="passwordReset-submitButton"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('processing')}
                </>
              ) : (
                t('sendResetLink')
              )}
            </Button>
            <UiLink
              type="Link"
              href={`/login?email=${encodeURIComponent(form.watch('email') || '')}${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
              replace={isDialog}
            >
              {t('backToLogin')}
            </UiLink>
          </div>
        </form>
      </Form>
    </div>
  );
}
