'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, NotebookPen, ReceiptText, Truck } from 'lucide-react';
import { SummaryCard, SummaryRow } from '@/components/ui/summary-card';
import type { Approval } from '@/platform/services/model/approval';

interface ApprovalSummaryProps {
  approval: Approval;
}

export const ApprovalSummary: React.FC<ApprovalSummaryProps> = ({ approval }) => {
  const t = useTranslations('orders.Approval');

  const details = approval.details;
  const items = approval.resource.items || [];
  const currency =
    details?.currency || approval.resource.totalPrice?.currency || approval.resource.subTotalPrice?.currency || 'EUR';

  const valueOfGoods = items.reduce((sum: number, it: any) => sum + (it?.itemPrice?.amount || 0), 0);
  const shippingCost = details?.shipping?.amount ?? 0;
  const vat = approval.resource.subtotalAggregate?.taxValue ?? 0;
  const total = approval.resource.totalPrice?.amount ?? valueOfGoods + shippingCost + vat;

  const shippingAddress = details?.addresses?.find?.((a: any) => a?.type === 'SHIPPING') || details?.addresses?.[0];
  const billingAddress = details?.addresses?.find?.((a: any) => a?.type === 'BILLING') || details?.addresses?.[1];
  const payment = details?.paymentMethods?.[0];

  const fmt = (amount: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);

  const renderAddress = (addr: any) =>
    addr ? (
      <div className="text-sm">
        {addr.firstName || addr.name || addr.companyName} {addr.lastName}
        <br />
        {addr.street} {addr.houseNumber}
        <br />
        {addr.postalCode} {addr.city}
        {addr.region ? `, ${addr.region}` : ''}
        <br />
        {addr.country}
      </div>
    ) : (
      <span className="text-sm text-text-placeholders">{t('notProvided')}</span>
    );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
        <SummaryCard
          heading={t('orderOverview')}
          className="shadow-none rounded-md py-4 h-full gap-2"
          icon={<ReceiptText className="h-5 w-5 text-text-action" />}
          hasHeadline
        >
          <SummaryRow label={t('valueOfGoods')} mutedLabel>
            {fmt(valueOfGoods)}
          </SummaryRow>
          <SummaryRow label={t('shippingCosts')} mutedLabel>
            {fmt(shippingCost)}
          </SummaryRow>
          <SummaryRow label={t('vat')} mutedLabel>
            {fmt(vat)}
          </SummaryRow>
          <SummaryRow label={t('totalValue')} strong>
            {fmt(total)}
          </SummaryRow>
        </SummaryCard>
      </div>

      <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
        <SummaryCard
          heading={t('transport')}
          className="shadow-none rounded-md py-4 h-full gap-2"
          icon={<Truck className="h-5 w-5 text-text-action" />}
          hasHeadline
        >
          <SummaryRow label={<span className="font-semibold">{t('transportCondition')}</span>}>
            {details?.shipping?.methodName || details?.shipping?.methodId || t('notProvided')}
          </SummaryRow>
          <div>
            <div className="text-sm font-semibold">{t('deliveryAddress')}</div>
            {renderAddress(shippingAddress)}
          </div>
        </SummaryCard>
      </div>

      <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
        <SummaryCard
          heading={t('payment')}
          className="shadow-none rounded-md py-4 h-full gap-2"
          icon={<CreditCard className="h-5 w-5 text-text-action" />}
          hasHeadline
        >
          <SummaryRow label={<span className="font-semibold">{t('paymentMethod')}</span>}>
            {payment?.name || payment?.type || t('notProvided')}
          </SummaryRow>
          <div>
            <div className="text-sm font-semibold">{t('billingAddress')}</div>
            {renderAddress(billingAddress)}
          </div>
        </SummaryCard>
      </div>

      <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
        <SummaryCard
          heading={t('other')}
          className="shadow-none rounded-md py-4 h-full gap-2"
          icon={<NotebookPen className="h-5 w-5 text-text-action" />}
          hasHeadline
        >
          <div>
            <div className="text-sm font-semibold">{t('note')}</div>
            <div className="text-sm text-text-placeholders">{approval.comment || t('noRequestorComment')}</div>
          </div>
        </SummaryCard>
      </div>
    </div>
  );
};
