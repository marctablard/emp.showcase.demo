import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrderConfirmation } from '@/components/checkout';
import {
  CREATED_APPROVAL_ID_QUERY_PARAM,
  isPendingApprovalConfirmationSegment,
  resolveCreatedApprovalId,
} from '@/components/checkout/confirmation-constants';
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

export default async function ConfirmationPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<ConfirmationPageProps>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>) {
  const { orderId } = await params;
  const search = await searchParams;
  const createdApprovalId = resolveCreatedApprovalId(search[CREATED_APPROVAL_ID_QUERY_PARAM]);

  if (isPendingApprovalConfirmationSegment(orderId)) {
    return (
      <OrderConfirmation orderId={orderId} initialOrder={null} customerEmail="" createdApprovalId={createdApprovalId} />
    );
  }

  const order = await getOrderById(orderId);

  return <OrderConfirmation orderId={orderId} initialOrder={order} customerEmail={order?.customerEmail || ''} />;
}
