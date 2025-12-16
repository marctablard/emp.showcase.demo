'use client';

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { usePathname, useRouter } from '@/i18n/navigation';
import { l10n } from '@/lib/utils';
import type { CompanyOnboardingStatus } from '@/platform/services/model/company/company';
import type { StorefrontNotification } from '@/platform/services/model/notification/notification';
import { ToastType, notify } from '../ui/toast-notification';

export function Notification() {
  const { registerNotificationListener, unregisterNotificationListener, markNotificationAsRead } = useNotifications();
  const t = useTranslations('common.Notification');
  const tLogin = useTranslations('auth.login');
  const locale = useLocale();

  useEffect(() => {
    const notificationSubscription = registerNotificationListener(
      'COMPANY',
      (notification: string | StorefrontNotification<CompanyOnboardingStatus>) => {
        if (typeof notification !== 'string') {
          if (notification.code !== 'COMPANY_ONBOARDING') {
            return;
          }
          const status = notification.data_json?.status;
          const message = l10n(notification.message, locale) || t('company.onboarding.' + status);
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

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();
  const hasShownWelcome = useRef(false);

  useEffect(() => {
    // Only show welcome message once per mount
    if (hasShownWelcome.current) {
      return;
    }

    // Check if login parameter is present
    const loginParam = searchParams.get('login');
    if (!loginParam) {
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
    router.push(pathname);
  }, [searchParams, session, t, pathname, router, tLogin]);

  return <></>;
}
