'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { useL10n } from '@/hooks/useL10n';
import { type AuthErrorKey, type NotificationOnboardingKey, dk } from '@/i18n/dynamic-key';
import { stripAuthNotificationQueryParams } from '@/lib/notification/auth-notification-utils';
import type { CompanyOnboardingStatus } from '@/platform/services/model/company/company';
import type { StorefrontNotification } from '@/platform/services/model/notification/notification';
import { ToastType, notify } from '../ui/toast-notification';

/**
 * Special Component for the Welcome-Notification after Login and Error Notifications
 */
function WelcomeNotification() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const hasShownWelcome = useRef(false);
  const hasCleanedAuthQuery = useRef(false);
  const hasPendingLoginNotification = useRef(false);
  const tLogin = useTranslations('auth.login');
  const tErrors = useTranslations('auth.errors');
  const t = useTranslations('common.Notification');

  useEffect(() => {
    // Only show welcome message once per mount
    if (hasShownWelcome.current) {
      return;
    }

    // Check if error parameter is present
    const errorParam = searchParams.get('error');
    if (errorParam) {
      const errorMessage = tErrors.has(dk<AuthErrorKey>(errorParam))
        ? tErrors(dk<AuthErrorKey>(errorParam))
        : tErrors('Default');

      notify({
        title: errorMessage,
        duration: 5000,
        type: ToastType.Error,
        button: {
          label: t('close'),
          onClick: () => {},
        },
      });

      // Mark as shown
      hasShownWelcome.current = true;
      if (!hasCleanedAuthQuery.current) {
        hasCleanedAuthQuery.current = true;
        window.history.replaceState({}, '', stripAuthNotificationQueryParams(window.location.href));
      }
      return;
    }

    // Check if login parameter is present
    const loginParam = searchParams.get('login');
    if (loginParam) {
      hasPendingLoginNotification.current = true;
      if (!hasCleanedAuthQuery.current) {
        hasCleanedAuthQuery.current = true;
        // Strip auth query params immediately to avoid stale URL cleanup racing with user navigation.
        window.history.replaceState({}, '', stripAuthNotificationQueryParams(window.location.href));
      }
    }

    if (!hasPendingLoginNotification.current) {
      return;
    }

    // Check if user is authenticated
    if (!session?.user) {
      return;
    }

    // Show welcome notification
    const username = session.user.name || session.user.email || '';
    const titleMessage = tLogin('welcomeMessage', { username });

    notify({
      title: titleMessage,
      duration: 3000,
      type: ToastType.Success,
      button: {
        label: t('close'),
        onClick: () => {},
      },
    });

    // Mark as shown
    hasShownWelcome.current = true;
  }, [searchParams, session, t, tLogin, tErrors]);

  return null;
}

export function Notification() {
  const { registerNotificationListener, unregisterNotificationListener, markNotificationAsRead } = useNotifications();
  const t = useTranslations('common.Notification');
  const { l10n } = useL10n();

  useEffect(() => {
    const notificationSubscription = registerNotificationListener(
      'COMPANY',
      (notification: string | StorefrontNotification<CompanyOnboardingStatus>) => {
        if (typeof notification !== 'string') {
          if (notification.code !== 'COMPANY_ONBOARDING') {
            return;
          }
          const status = notification.data_json?.status;
          const message =
            l10n(notification.message) || t(dk<NotificationOnboardingKey>('company.onboarding.' + status));
          let type = ToastType.Success;
          switch (status) {
            case 'rejected':
              type = ToastType.Error;
              break;
            case 'pending':
              type = ToastType.Warning;
              break;
            default:
            case 'approved':
              type = ToastType.Success;
              break;
          }

          markNotificationAsRead(notification.id);
          notify({
            title: message,
            type: type,
            button: {
              label: t('close'),
              onClick: () => {},
            },
          });
        }
      },
    );
    return () => {
      unregisterNotificationListener(notificationSubscription);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Suspense fallback={<></>}>
      <WelcomeNotification />
    </Suspense>
  );
}
