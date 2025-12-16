'use client';

import { ReactNode, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { H1 } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useValidator } from '@/hooks/validation/useValidator';
import { useRouter } from '@/i18n/navigation';

type PasswordResetProps = {
  trigger?: ReactNode;
  email?: string;
  open?: boolean;
  onCloseAction?: () => void;
  onBackToLoginAction?: (email: string) => void;
};

export function PasswordResetDialog({
  trigger,
  email,
  open = false,
  onCloseAction,
  onBackToLoginAction,
}: PasswordResetProps) {
  const t = useTranslations('auth.Password');
  const router = useRouter();

  const { form } = useValidator(
    'PasswordResetValidationService',
    {
      email: email || '',
    },
    'onChange',
  );
  const isSubmitting = form.formState.isSubmitting;
  const isValid = form.formState.isValid;

  // Reset form when dialog changes or closes
  useEffect(() => {
    // Reset form fields and errors when dialog changes
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

    onBackToLoginAction?.(form.getValues('email'));
  }

  const handleOpenChange = (open: boolean) => {
    // If the dialog is being closed and we're on the login page, redirect to home, because the login page is empty an only for SSR
    if (!open && window.location.pathname.endsWith('/login')) {
      router.push('/');
      onCloseAction?.();
      return;
    }

    // Normal behavior for all other pages
    if (!open) onCloseAction?.();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}

      <DialogContent className="sm:max-w-150">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
            <DialogHeader>
              <VisuallyHidden>
                <DialogHeader>
                  <DialogTitle />
                  <DialogDescription />
                </DialogHeader>
              </VisuallyHidden>
              <div className="space-y-1">
                <H1 variant="h4">{t('resetPassword')}</H1>
                <p>{t('resetPasswordDescription')}</p>
              </div>
            </DialogHeader>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel>{t('email')}</FormLabel>
                  <FormControl>
                    <Input placeholder="email@example.com" type="email" {...field} />
                  </FormControl>
                  <div className="absolute top-full left-0 mt-0.5">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <DialogFooter className="flex flex-col sm:flex sm:flex-col gap-6 w-full items-center">
              <Button type="submit" className="w-full" disabled={isSubmitting || !isValid}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('processing')}
                  </>
                ) : (
                  t('sendResetLink')
                )}
              </Button>
              <UiLink type="Button" onClick={() => onBackToLoginAction?.(form.getValues('email'))}>
                {t('backToLogin')}
              </UiLink>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
