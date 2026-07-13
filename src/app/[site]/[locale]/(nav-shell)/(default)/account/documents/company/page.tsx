import { useTranslations } from 'next-intl';
import PlaceholderPage from '@/components/account/placeholder-page';

export default function CompanyDocumentsPage() {
  const t = useTranslations('account.Documents');

  return <PlaceholderPage title={t('categories.company')} />;
}
