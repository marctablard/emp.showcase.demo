'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import { l10n } from '@/lib/utils';
import type { CompanyOnboardingStatus } from '@/platform/services/model/company/company';
import type { StorefrontNotification } from '@/platform/services/model/notification/notification';
import { ToastType, notify } from '../ui/toast-notification';

export function Notification() {
  const { registerNotificationListener, unregisterNotificationListener, markNotificationAsRead } = useNotifications();
  const t = useTranslations('common.Notification');
  const locale = useLocale();

  useEffect(() => {
    const notificationSubscription = registerNotificationListener(
      'COMPANY',
      (notification: string | StorefrontNotification<CompanyOnboardingStatus>) => {
        if (!(typeof notification === 'string')) {
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
  }, []);

  return <></>;
}
