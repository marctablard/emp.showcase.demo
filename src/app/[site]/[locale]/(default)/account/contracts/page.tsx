import { useTranslations } from 'next-intl';
import PlaceholderPage from '@/components/account/placeholder-page';

export default function ContractsPage() {
  const t = useTranslations('account.Documents');

  return <PlaceholderPage title={t('categories.contracts')} />;
}
