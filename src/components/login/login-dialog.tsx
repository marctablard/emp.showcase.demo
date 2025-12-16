'use client';

import { ReactNode, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Eye, EyeOff, Loader2, LockKeyhole, User } from 'lucide-react';
import { providerOptions } from '@/auth/auth.config';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Heading } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import useAuthDialog from '@/hooks/authentication/useAuthDialog';
import useAuthentication from '@/hooks/authentication/useAuthentication';
import { useValidator } from '@/hooks/validation/useValidator';
import { useRouter } from '@/i18n/navigation';

type LoginData = {
  username: string;
  password: string;
};

type LoginProps = {
  callbackUrl?: string;
  trigger?: ReactNode;
  defaultOpen?: boolean;
  redirectAfterLogin?: boolean;
  email?: string;
  open?: boolean;
  onCloseAction?: () => void;
  onResetPasswordAction?: (email: string) => void;
  guestCheckout?: boolean;
};

export default function LoginDialog({
  trigger,
  callbackUrl,
  email,
  open = false,
  onCloseAction,
  onResetPasswordAction,
  guestCheckout = false,
}: LoginProps) {
  const t = useTranslations('auth.login');
  const { login, loading } = useAuthentication();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { activeDialog } = useAuthDialog();
  const [submitting, setSubmitting] = useState(false);

  const { form } = useValidator(
    'LoginValidationService',
    {
      username: email || '',
      password: '',
    },
    'onChange',
  );

  // Reset form when dialog changes or closes
  useEffect(() => {
    // Reset form fields and errors when dialog changes
    if (form) {
      form.reset({ username: email || '', password: '' });
      setError(null);
      setShowPassword(false);
    }
  }, [activeDialog, email, form]);

  async function onSubmit(values: LoginData) {
    setError(null);
    if (submitting) return; // Prevent double submit
    setSubmitting(true);

    try {
      const success = await login(values.username, values.password, callbackUrl);

      if (!success) {
        setError(t('invalidCredentials'));
        form.resetField('password', { defaultValue: '' });
      } else {
        onCloseAction?.();

        form.resetField('username', { defaultValue: '' });
        form.resetField('password', { defaultValue: '' });
      }
    } finally {
      setSubmitting(false);
    }
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

      <DialogContent className="sm:max-w-[639px]">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
            {/* Loading Overlay */}
            {(loading || submitting) && (
              <div className="absolute inset-0 z-1000 bg-surface/50 backdrop-blur-default flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-medium text-text-secondary">{t('loggingIn')}</p>
                </div>
              </div>
            )}
            <DialogHeader>
              <VisuallyHidden>
                <DialogTitle />
                <DialogDescription />
              </VisuallyHidden>
              <Heading variant="h4" as="div">
                {t('title')}
              </Heading>
            </DialogHeader>

            {error && (
              <div className="flex flex-col gap-2">
                <Heading variant="h5" as="div" className="text-text-error">
                  {t('loginFailed')}
                </Heading>
                <span className="text-text-error">{error}</span>
              </div>
            )}

            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className="relative">
                  <FormLabel htmlFor="username">{t('username')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('username')}
                      type="email"
                      autoComplete="username"
                      id="username"
                      startIcon={User}
                      {...field}
                    />
                  </FormControl>
                  <div className="absolute top-full left-0 mt-0.5">
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="relative">
                    <FormLabel htmlFor="password">{t('password')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('password')}
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="current-password"
                        id="password"
                        startIcon={LockKeyhole}
                        endIcon={showPassword ? Eye : EyeOff}
                        onEndIconClick={() => setShowPassword(!showPassword)}
                        endIconLabel={showPassword ? t('hidePassword') : t('showPassword')}
                        {...field}
                      />
                    </FormControl>
                    <div className="absolute top-full left-0 mt-0.5">
                      <FormMessage />
                    </div>
                  </FormItem>
                )}
              />
              <UiLink
                className="self-end"
                type="Button"
                onClick={() => onResetPasswordAction?.(form.getValues('username'))}
              >
                {t('forgotPassword')}
              </UiLink>
            </div>

            <Button type="submit" disabled={loading || submitting || !form.formState.isValid}>
              {loading || submitting ? t('loggingIn') : t('logIn')}
            </Button>
          </form>
        </Form>

        {Object.values(providerOptions).map((provider) => (
          <form
            className="flex flex-col gap-6 w-full"
            key={provider.id}
            action={async () => {
              try {
                await signIn(provider.id, {
                  redirectTo: callbackUrl ?? '',
                });
              } catch (error) {
                throw error;
              }
            }}
          >
            <Button type="submit" disabled={loading} className={`transition-all`}>
              <span>{t('signInWith', { provider: provider.name })}</span>
            </Button>
          </form>
        ))}
        <DialogFooter className="flex flex-col sm:flex sm:flex-col gap-6 w-full">
          {guestCheckout && (
            <DialogClose asChild>
              <Link href="/checkout">
                <Button variant="secondary" className="w-full">
                  {t('guestCheckout')}
                </Button>
              </Link>
            </DialogClose>
          )}

          <div className="flex flex-col gap-2 mx-auto items-center">
            <p>{t('noAccountYet')}</p>
            <DialogClose asChild>
              <UiLink type="Link" href="/register">
                {t('createAccount')}
              </UiLink>
            </DialogClose>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
