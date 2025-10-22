import { getTranslations } from 'next-intl/server';
import AccountLayout from '@/components/account/account-layout';
import { OrderDetail } from '@/components/account/orders/order-detail';
import { getOrderById } from '@/lib/ssr/orders';
import { getPageTitle } from '@/lib/ssr/seo';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: 'orders' });

  return {
    title: await getPageTitle(`${t('orderDetails')} #${id}`, locale),
    description: t('orderDetails'),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  // Fetch order data during SSR
  const { id, locale } = await params;
  const [initialOrder, tOrders, tAccount] = await Promise.all([
    getOrderById(id),
    getTranslations({ locale, namespace: 'orders' }),
    getTranslations({ locale, namespace: 'account' }),
  ]);
  const breadcrumbs = [
    {
      href: '/account',
      label: tAccount('accountDetails'),
    },
    {
      href: '/account/orders',
      label: tAccount('ordersAndReturns'),
    },
    {
      href: `/account/orders/${id}`,
      label: tOrders('orderDetails') + ` #${id}`,
    },
  ];
  return (
    <AccountLayout breadcrumbs={breadcrumbs}>
      <OrderDetail orderId={id} initialOrder={initialOrder} />
    </AccountLayout>
  );
}
