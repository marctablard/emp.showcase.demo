'use client';

import { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Loader2, LockKeyhole, User, XCircle } from 'lucide-react';
import { providerOptions } from '@/auth/auth.config';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Heading } from '@/components/ui/h';
import { Input } from '@/components/ui/input';
import UiLink from '@/components/ui/link';
import useAuthentication from '@/hooks/authentication/useAuthentication';
import { useSite } from '@/hooks/site/useSite';
import { useValidator } from '@/hooks/validation/useValidator';
import { Link, getPathname } from '@/i18n/navigation';

type LoginData = {
  username: string;
  password: string;
};

type LoginFormProps = {
  callbackUrl?: string;
  email?: string;
  onSuccess?: () => void;
  guestCheckout?: boolean;
  onGuestAction?: () => void;
  isDialog?: boolean;
};

export function LoginForm({
  callbackUrl,
  email,
  onSuccess,
  guestCheckout = false,
  onGuestAction,
  isDialog = false,
}: LoginFormProps) {
  const t = useTranslations('auth.login');
  const locale = useLocale();
  const { site } = useSite();
  const { login, loading } = useAuthentication();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { form } = useValidator(
    'LoginValidationService',
    {
      username: email || '',
      password: '',
    },
    'onChange',
  );

  const searchParams = useSearchParams();
  if (email === undefined) {
    email = searchParams.get('email') ?? undefined;
  }
  if (callbackUrl === undefined) {
    callbackUrl = searchParams.get('callbackUrl') ?? '/account';
  }
  guestCheckout = guestCheckout || searchParams.get('guestCheckout') === 'true';

  // Reset form when email changes
  useEffect(() => {
    if (form) {
      form.reset({ username: email || '', password: '' });
      setError(null);
      setShowPassword(false);
    }
  }, [email, form]);

  async function onSubmit(values: LoginData) {
    setError(null);
    if (submitting) return; // Prevent double submit
    setSubmitting(true);

    try {
      // In dialog mode with onSuccess, skip callbackUrl so login() doesn't redirect away —
      // the caller (e.g. quick-order) handles post-login action via the onSuccess callback.
      const loginCallbackUrl = isDialog && onSuccess ? undefined : callbackUrl;
      const success = await login(values.username, values.password, loginCallbackUrl);

      if (!success) {
        setError(t('invalidCredentials'));
        form.resetField('password', { defaultValue: '' });
      } else if (isDialog && onSuccess) {
        onSuccess();
      } else if (!callbackUrl) {
        onSuccess?.();
      }
      // On success with callbackUrl (non-dialog), the login() function handles the redirect via window.location.href
    } finally {
      setSubmitting(false);
    }
  }

  // Dialog login: @dialog onCloseAction calls router.back() when the URL still ends in /login.
  // Fixes client Link → dialog closes first → back() races /register (no redirect or bad history).
  // assign() is a full navigation that avoids that stack; no extra onCloseAction branches needed.
  const handleRegisterRedirect = (): void => {
    if (!isDialog) return;
    window.location.assign(
      getPathname({
        href: '/register',
        locale,
        site: site?.code,
        forcePrefix: true,
      }),
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Loading Overlay */}
      {(loading || submitting) && (
        <div className="absolute inset-0 z-1000 bg-surface/50 backdrop-blur-default flex items-center justify-center rounded-md">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            {submitting && <p className="text-sm font-medium text-text-secondary">{t('loggingIn')}</p>}
          </div>
        </div>
      )}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 w-full">
          <Heading variant="h4" as="div">
            {t('title')}
          </Heading>

          {error && (
            <Alert variant="destructive" data-testid="login-error">
              <XCircle />
              <AlertTitle>{t('loginFailed')}</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
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
                    data-testid="login-username"
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
                      data-testid="login-password"
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
              type="Link"
              href={`/password-reset?email=${encodeURIComponent(form.watch('username') || '')}${callbackUrl ? `&callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
              replace={isDialog}
            >
              {t('forgotPassword')}
            </UiLink>
          </div>

          <Button
            type="submit"
            disabled={loading || submitting || !form.formState.isValid}
            data-testid="login-submitButton"
          >
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
          <Button
            type="submit"
            disabled={loading}
            className={`transition-all`}
            data-testid={`login-oauth-${provider.id}`}
          >
            <span>{t('signInWith', { provider: provider.name })}</span>
          </Button>
        </form>
      ))}

      <div className="flex flex-col gap-6 w-full">
        {guestCheckout &&
          (onGuestAction ? (
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              data-testid="login-guestCheckout"
              onClick={onGuestAction}
            >
              {t('guestCheckout')}
            </Button>
          ) : (
            <Button asChild variant="secondary" className="w-full" data-testid="login-guestCheckout">
              <Link href="/checkout">{t('guestCheckout')}</Link>
            </Button>
          ))}

        <div className="flex flex-col gap-2 mx-auto items-center">
          <p>{t('noAccountYet')}</p>
          {isDialog ? (
            <UiLink type="Button" onClick={handleRegisterRedirect} data-testid="login-createAccount">
              {t('createAccount')}
            </UiLink>
          ) : (
            <UiLink type="Link" href="/register" data-testid="login-createAccount">
              {t('createAccount')}
            </UiLink>
          )}
        </div>
      </div>
    </div>
  );
}
