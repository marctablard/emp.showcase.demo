import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { TicketsList } from '@/components/account/tickets/tickets-list';
import { getPageTitle } from '@/lib/ssr/seo';
import { getServiceTicketTypes, getServiceTickets } from '@/lib/ssr/servicetickets';

// Force dynamic rendering to ensure fresh, customer-scoped data
export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account.serviceTickets' });

  return {
    title: await getPageTitle(t('title'), locale),
    description: t('description'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function TicketsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;

  const [tAccount, tTickets, tickets, types] = await Promise.all([
    getTranslations({ locale, namespace: 'account' }),
    getTranslations({ locale, namespace: 'account.serviceTickets' }),
    getServiceTickets(locale),
    getServiceTicketTypes(locale),
  ]);

  const breadcrumbs = [
    { href: '/account', label: tAccount('title') },
    { href: '/account/tickets', label: tTickets('title') },
  ];

  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <TicketsList initialTickets={tickets ?? []} types={types} />
    </AccountLayout>
  );
}
