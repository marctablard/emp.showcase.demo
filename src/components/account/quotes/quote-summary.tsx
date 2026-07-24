'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { List, ReceiptText, Truck } from 'lucide-react';
import { H5 } from '@/components/ui/h';
import { SummaryCard, SummaryField } from '@/components/ui/summary-card';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import type { Quote } from '@/platform/services/model/quote';

interface QuoteSummaryProps {
  quote: Quote;
}

export const QuoteSummary: React.FC<QuoteSummaryProps> = ({ quote }) => {
  const t = useTranslations('account.quoteDetails');

  // Get quote data
  const currency = quote.currency || getPublicDefaultCurrency();

  // Format currency values
  const fmt = (amount: number) => `${amount.toFixed(2)} ${currency}`;

  const renderPriceRows = (totalLabel: string) => (
    <div className="space-y-4 text-base font-body text-text-body">
      <div className="flex justify-between gap-4">
        <span>{t('netValue')}</span>
        <span>{fmt(quote.totalNet)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>{t('vat')}</span>
        <span>{fmt(quote.totalVat)}</span>
      </div>
      <div className="flex justify-between gap-4">
        <span>{t('shippingFee')}</span>
        <span>{fmt(quote.shippingCost)}</span>
      </div>
      <div className="flex items-start justify-between gap-4 pt-2">
        <H5>{totalLabel}</H5>
        <H5>{fmt(quote.totalNet + quote.totalVat + quote.shippingCost)}</H5>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* Base Price Card */}
      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
        <SummaryCard
          heading={t('basePrice')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="p-0"
          icon={<List className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          {renderPriceRows(t('baseTotal'))}
        </SummaryCard>
      </div>

      {/* Shipping Card */}
      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
        <SummaryCard
          heading={t('shipping')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="space-y-4 p-0"
          icon={<Truck className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          <SummaryField label={t('transportCondition')}>{quote.shippingMethod}</SummaryField>
          <SummaryField label={t('deliveryAddress')}>
            {quote.shippingAddress.contactName}
            <br />
            {quote.shippingAddress.street}
            <br />
            {quote.shippingAddress.zipCode} {quote.shippingAddress.city}
            <br />
            {quote.shippingAddress.country}
          </SummaryField>
        </SummaryCard>
      </div>

      {/* Quoted Price Card */}
      <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm border-2 border-border-success">
        <SummaryCard
          heading={t('quotedPrice')}
          className="h-full gap-4 rounded-md p-4 shadow-none"
          headerClassName="p-0"
          contentClassName="p-0"
          icon={<ReceiptText className="h-8 w-8 text-text-action" />}
          hasHeadline
        >
          {renderPriceRows(t('quotedTotal'))}
        </SummaryCard>
      </div>
    </div>
  );
};
