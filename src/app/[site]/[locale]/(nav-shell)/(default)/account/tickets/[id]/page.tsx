import { useTranslations } from 'next-intl';
import PlaceholderPage from '@/components/account/placeholder-page';

export default function TicketDetailPage() {
  const t = useTranslations('account.Tickets');

  return <PlaceholderPage title={t('title')} />;
}
