import { useTranslations } from 'next-intl';
import PlaceholderPage from '@/components/account/placeholder-page';

export default function ReturnsPage() {
  const t = useTranslations('account');

  return <PlaceholderPage title={t('returns')} />;
}
