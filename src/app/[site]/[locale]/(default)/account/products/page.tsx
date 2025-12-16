import { useTranslations } from 'next-intl';
import PlaceholderPage from '@/components/account/placeholder-page';

export default function ProductsPage() {
  const t = useTranslations('account.sidebar.items');

  return <PlaceholderPage title={t('productsMaintenance')} />;
}
