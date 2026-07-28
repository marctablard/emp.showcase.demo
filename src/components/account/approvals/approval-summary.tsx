'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { CreditCard, List, NotebookPen, ReceiptText, Truck } from 'lucide-react';
import { H5 } from '@/components/ui/h';
import { SummaryCard, SummaryRow } from '@/components/ui/summary-card';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import type { Approval, ApprovalResourceItem } from '@/platform/services/model/approval';

interface ApprovalSummaryProps {
  approval: Approval;
}

export const ApprovalSummary: React.FC<ApprovalSummaryProps> = ({ approval }) => {
  const t = useTranslations('orders.Approval');

  const details = approval.details;
  const items = approval.resource.items || [];
  const currency =
    details?.currency ||
    approval.resource.totalPrice?.currency ||
    approval.resource.subTotalPrice?.currency ||
    getPublicDefaultCurrency();

  const valueOfGoods = items.reduce((sum: number, it: ApprovalResourceItem) => sum + (it.itemPrice?.amount || 0), 0);
  const shippingCost = details?.shipping?.amount ?? 0;
  const vat = approval.resource.subtotalAggregate?.taxValue ?? 0;
  const total = approval.resource.totalPrice?.amount ?? valueOfGoods + shippingCost + vat;

  const shippingAddress = details?.addresses?.find?.((a: any) => a?.type === 'SHIPPING') || details?.addresses?.[0];
  const billingAddress = details?.addresses?.find?.((a: any) => a?.type === 'BILLING') || details?.addresses?.[1];
  const payment = details?.paymentMethods?.[0];
  const isQuote = approval.resourceType === 'QUOTE';

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

  const renderQuotePriceRows = (totalLabel: string) => (
    <div className="space-y-4 text-base font-body text-text-body">
      <SummaryRow label={t('netValueOfGoods')} mutedLabel>
        {fmt(valueOfGoods)}
      </SummaryRow>
      <SummaryRow label={t('vat')} mutedLabel>
        {fmt(vat)}
      </SummaryRow>
      <SummaryRow label={t('shippingFee')} mutedLabel>
        {fmt(shippingCost)}
      </SummaryRow>
      <div className="flex items-start justify-between gap-4 pt-2">
        <H5>{totalLabel}</H5>
        <H5>{fmt(total)}</H5>
      </div>
    </div>
  );

  if (isQuote) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
          <SummaryCard
            heading={t('quoteDetails')}
            className="h-full gap-4 rounded-md p-4 shadow-none"
            headerClassName="p-0"
            contentClassName="space-y-4 p-0"
            icon={<NotebookPen className="h-8 w-8 text-text-action" />}
            hasHeadline
          >
            <div>
              <div className="text-sm text-text-on-disabled">{t('quoteReference')}</div>
              <H5>{approval.resource.id}</H5>
            </div>
            <div>
              <div className="text-sm text-text-on-disabled">{t('numberOfProducts')}</div>
              <H5>{items.length}</H5>
            </div>
          </SummaryCard>
        </div>

        <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
          <SummaryCard
            heading={t('basePrice')}
            className="h-full gap-4 rounded-md p-4 shadow-none"
            headerClassName="p-0"
            contentClassName="p-0"
            icon={<List className="h-8 w-8 text-text-action" />}
            hasHeadline
          >
            {renderQuotePriceRows(t('baseTotal'))}
          </SummaryCard>
        </div>

        <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm border-2 border-border-success">
          <SummaryCard
            heading={t('quotedPrice')}
            className="h-full gap-4 rounded-md p-4 shadow-none"
            headerClassName="p-0"
            contentClassName="p-0"
            icon={<ReceiptText className="h-8 w-8 text-text-action" />}
            hasHeadline
          >
            {renderQuotePriceRows(t('quotedTotal'))}
          </SummaryCard>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
        <SummaryCard
          heading={t('orderOverview')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<ReceiptText className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          <SummaryRow label={t('netValueOfGoods')} mutedLabel>
            {fmt(valueOfGoods)}
          </SummaryRow>
          <SummaryRow label={t('vat')} mutedLabel>
            {fmt(vat)}
          </SummaryRow>
          <SummaryRow label={t('shippingFee')} mutedLabel>
            {fmt(shippingCost)}
          </SummaryRow>
          <SummaryRow label={t('totalValue')} strong>
            {fmt(total)}
          </SummaryRow>
        </SummaryCard>
      </div>

      <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
        <SummaryCard
          heading={t('shipping')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<Truck className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          <SummaryRow label={<span className="font-semibold">{t('shippingMethod')}</span>}>
            {details?.shipping?.methodName || details?.shipping?.methodId || t('notProvided')}
          </SummaryRow>
          <div>
            <div className="text-sm font-semibold">{t('shippingAddress')}</div>
            {renderAddress(shippingAddress)}
          </div>
        </SummaryCard>
      </div>

      <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
        <SummaryCard
          heading={t('payment')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<CreditCard className="h-8 w-8 text-text-action" />}
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
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<NotebookPen className="h-8 w-8 text-text-action" />}
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
