import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import AccountLayout from '@/components/account/account-layout';
import { TicketDetail } from '@/components/account/tickets/ticket-detail';
import { getPageTitle } from '@/lib/ssr/seo';
import { getServiceTicketById } from '@/lib/ssr/servicetickets';

// Force dynamic rendering for personalized content
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'account.serviceTickets' });

  return {
    title: await getPageTitle(`${t('detail.title')} #${id}`, locale),
    description: t('description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function TicketDetailPage({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;

  const [tAccount, tTickets, ticket] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'account.serviceTickets' }),
    getServiceTicketById(id, locale),
  ]);

  if (!ticket) {
    notFound();
  }

  const breadcrumbs = [
    { href: '/account', label: tAccount('title') },
    { href: '/account/tickets', label: tTickets('title') },
    { href: `/account/tickets/${id}`, label: ticket.subject || `#${id}` },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <TicketDetail ticket={ticket} />
    </AccountLayout>
  );
}
