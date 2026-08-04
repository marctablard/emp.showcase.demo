'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CreditCard, List, NotebookPen, ReceiptText, Truck } from 'lucide-react';
import { resolveApprovalNetAmount } from '@/components/account/approvals/approval-net-amount';
import { H5 } from '@/components/ui/h';
import { SummaryCard, SummaryRow } from '@/components/ui/summary-card';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatCurrency } from '@/lib/utils';
import type { Approval, ApprovalResourceItem } from '@/platform/services/model/approval';

interface ApprovalSummaryProps {
  approval: Approval;
}

export const ApprovalSummary: React.FC<ApprovalSummaryProps> = ({ approval }) => {
  const t = useTranslations('orders.Approval');
  const locale = useLocale();

  const details = approval.details;
  const items = approval.resource.items || [];
  const netTotal = resolveApprovalNetAmount(approval);
  const currency =
    details?.currency ||
    netTotal?.currency ||
    approval.resource.totalPrice?.currency ||
    approval.resource.subTotalPrice?.currency ||
    getPublicDefaultCurrency();

  const valueOfGoods = items.reduce((sum: number, it: ApprovalResourceItem) => sum + (it.itemPrice?.amount || 0), 0);
  const shippingCost = details?.shipping?.amount ?? 0;
  const vat = approval.resource.subtotalAggregate?.taxValue ?? 0;
  // Finding 26: model-backed net only — never totalPrice.amount or invented goods+shipping+vat.
  const formattedNetTotal = netTotal ? formatCurrency(netTotal.amount, netTotal.currency, locale) : '-';

  const shippingAddress = details?.addresses?.find?.((a: any) => a?.type === 'SHIPPING') || details?.addresses?.[0];
  const billingAddress = details?.addresses?.find?.((a: any) => a?.type === 'BILLING') || details?.addresses?.[1];
  const payment = details?.paymentMethods?.[0];
  const isQuote = approval.resourceType === 'QUOTE';

  const fmt = (amount: number) => formatCurrency(amount, currency, locale);
  const vatRateSuffix = valueOfGoods > 0 ? ` (${Math.round((vat / valueOfGoods) * 100)}%)` : '';

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

  const renderQuotePriceRows = (heading: string) => (
    <div className="space-y-4 text-base font-body text-text-body">
      <div className="flex justify-between gap-4">
        <span>{t('netValueOfGoods')}</span>
        <span>{fmt(valueOfGoods)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>
          {t('vat')}
          {vatRateSuffix}
        </span>
        <span>{fmt(vat)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>{t('shippingFee')}</span>
        <span>{fmt(shippingCost)}</span>
      </div>
      <div className="flex items-start justify-between gap-4 pt-2">
        <H5>{heading}</H5>
        <H5>{formattedNetTotal}</H5>
      </div>
    </div>
  );

  if (isQuote) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
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

        <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
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

        {/* Quoted Price — success surface without dual blue+green border (match Quote Task 3.1) */}
        <div className="rounded-md bg-surface-success p-6 shadow-sm" data-testid="approval-summary-quoted-price">
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

  // 1024+ box layout: 2×2 cards (Figma 11895-138509)
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
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
            {formattedNetTotal}
          </SummaryRow>
        </SummaryCard>
      </div>

      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
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

      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
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

      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
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
