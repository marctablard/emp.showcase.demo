import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrderConfirmation } from '@/components/checkout';
import { isPendingApprovalConfirmationSegment } from '@/components/checkout/confirmation-constants';
import { getOrderById } from '@/lib/ssr/orders';

interface ConfirmationPageProps {
  orderId: string;
  locale: string;
}

export async function generateMetadata({ params }: { params: Promise<ConfirmationPageProps> }): Promise<Metadata> {
  const { locale } = await params;

  const t = await getTranslations({ locale, namespace: 'orders.Confirmation' });

  return {
    title: t('title'),
    description: t('description'),
  };
}

export default async function ConfirmationPage({ params }: { params: Promise<ConfirmationPageProps> }) {
  const { orderId } = await params;

  if (isPendingApprovalConfirmationSegment(orderId)) {
    return <OrderConfirmation orderId={orderId} initialOrder={null} customerEmail="" />;
  }

  const order = await getOrderById(orderId);

  return <OrderConfirmation orderId={orderId} initialOrder={order} customerEmail={order?.customerEmail || ''} />;
}
