import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { MyOrdersCard } from '@/components/account/dashboard/cards/my-orders-card';
import { getOrders } from '@/lib/ssr/orders';
import { getPageTitle } from '@/lib/ssr/seo';

// Force dynamic rendering to ensure fresh data on every navigation to the Order History page.
export const dynamic = 'force-dynamic';

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
  const [tAccount, orders] = await Promise.all([getTranslations({ locale, namespace: 'account' }), getOrders(50, 1)]);
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
      <MyOrdersCard initialOrders={orders ?? undefined} pageMode />
    </AccountLayout>
  );
}
