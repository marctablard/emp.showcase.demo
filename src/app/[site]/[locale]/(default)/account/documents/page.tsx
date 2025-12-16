import { useTranslations } from 'next-intl';
import PlaceholderPage from '@/components/account/placeholder-page';

export default function DocumentsPage() {
  const t = useTranslations('account.Documents');

  return <PlaceholderPage title={t('title')} />;
}
