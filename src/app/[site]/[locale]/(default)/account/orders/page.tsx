import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { MyOrdersCard } from '@/components/account/dashboard/cards/my-orders-card';
import { getPageTitle } from '@/lib/ssr/seo';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'account' });

  return {
    title: await getPageTitle(t('ordersAndReturns'), locale),
    description: t('ordersPageDescription'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function OrdersPage({ params }: { params: Promise<{ locale: string }> }) {
  // Fetch order data during SSR
  const { locale } = await params;
  const [tAccount] = await Promise.all([getTranslations({ locale, namespace: 'account' })]);
  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/orders',
      label: tAccount('ordersAndReturns'),
    },
  ];
  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <MyOrdersCard />
    </AccountLayout>
  );
}
