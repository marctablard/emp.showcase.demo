import { useTranslations } from 'next-intl';
import PlaceholderPage from '@/components/account/placeholder-page';

export default function NotificationsPage() {
  const t = useTranslations('account.Notifications');

  return <PlaceholderPage title={t('title')} />;
}
