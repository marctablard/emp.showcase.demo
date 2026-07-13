import { useTranslations } from 'next-intl';
import PlaceholderPage from '@/components/account/placeholder-page';

export default function InboxPage() {
  const t = useTranslations('account');

  return <PlaceholderPage title={t('inbox')} />;
}
