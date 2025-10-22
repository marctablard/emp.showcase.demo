'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { List, NotebookPen, ReceiptText, Truck } from 'lucide-react';
import { SummaryCard, SummaryRow } from '@/components/ui/summary-card';
import { formatDate } from '@/lib/date-utils';
import { Quote } from '@/platform/services/model/quote';

interface QuoteSummaryProps {
  quote: Quote;
}

export const QuoteSummary: React.FC<QuoteSummaryProps> = ({ quote }) => {
  const t = useTranslations('account.quoteDetails');

  // Get quote data
  const currency = quote.currency || 'EUR';
  const itemCount = quote.items?.reduce((total, item) => total + (item.quantity.quantity || 0), 0) || 0;

  // Format currency values
  const fmt = (amount: number) => `${amount.toFixed(2)} ${currency}`;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* Details Card */}
      <div className="p-6 rounded-lg bg-primary-50 shadow-sm">
        <SummaryCard
          heading={t('details')}
          className="shadow-none rounded-md py-4 h-full gap-2"
          icon={<NotebookPen className="h-8 w-8 text-primary" />}
          hasHeadline
        >
          <div className="space-y-3">
            <div>
              <div className="text-xl font-bold">{t('quotationDate')}</div>
              <div className="text-md">{formatDate(quote.submittedDate)}</div>
            </div>

            <div>
              <div className="text-xl font-bold">{t('requestedBy')}</div>
              <div className="text-md">{quote.customerName || quote.customerId}</div>
            </div>

            <div>
              <div className="text-xl font-bold">{t('numberOfProducts')}</div>
              <div className="text-md">{itemCount}</div>
            </div>
          </div>
        </SummaryCard>
      </div>

      {/* Base Price Card */}
      <div className="p-6 rounded-lg bg-primary-50 shadow-sm">
        <SummaryCard
          heading={t('basePrice')}
          className="shadow-none rounded-md py-4 h-full gap-2"
          icon={<List className="h-8 w-8 text-primary" />}
          hasHeadline
        >
          <div className="space-y-3">
            <SummaryRow label={t('netValue')} className="text-md">
              {fmt(quote.totalNet)}
            </SummaryRow>
            <SummaryRow label={t('vat')} className="text-md">
              {fmt(quote.totalVat)}
            </SummaryRow>
            <SummaryRow label={t('deliveryCosts')} className="text-md">
              {fmt(quote.shippingCost)}
            </SummaryRow>
            <SummaryRow label={t('baseTotal')} strong className="text-md">
              {fmt(quote.totalNet + quote.totalVat + quote.shippingCost)}
            </SummaryRow>
          </div>
        </SummaryCard>
      </div>

      {/* Transport Card */}
      <div className="p-6 rounded-lg bg-primary-50 shadow-sm">
        <SummaryCard
          heading={t('transport')}
          className="shadow-none rounded-md py-4 h-full gap-2"
          icon={<Truck className="h-8 w-8 text-primary" />}
          hasHeadline
        >
          <div className="space-y-3">
            <div>
              <div className="text-xl font-bold">{t('transportCondition')}</div>
              <div className="text-md">{quote.shippingMethod}</div>
            </div>

            <div>
              <div className="text-xl font-bold">{t('deliveryAddress')}</div>
              <div className="text-md">
                {quote.shippingAddress.contactName}
                <br />
                {quote.shippingAddress.street}
                <br />
                {quote.shippingAddress.zipCode} {quote.shippingAddress.city}
                <br />
                {quote.shippingAddress.country}
              </div>
            </div>
          </div>
        </SummaryCard>
      </div>

      {/* Quoted Price Card */}
      <div className="p-6 rounded-lg bg-primary-50 shadow-sm gap-2">
        <SummaryCard
          heading={t('quotedPrice')}
          className="shadow-none rounded-md py-4 h-full gap-2"
          icon={<ReceiptText className="h-8 w-8 text-primary" />}
          hasHeadline
        >
          <SummaryRow label={t('netValue')} className="text-md">
            {fmt(quote.totalNet)}
          </SummaryRow>
          <SummaryRow label={t('vat')} className="text-md">
            {fmt(quote.totalVat)}
          </SummaryRow>
          <SummaryRow label={t('transportCost')} className="text-md">
            {fmt(quote.shippingCost)}
          </SummaryRow>
          <SummaryRow label={t('quotedTotal')} className="text-md" strong>
            {fmt(quote.totalNet + quote.totalVat + quote.shippingCost)}
          </SummaryRow>
        </SummaryCard>
      </div>
    </div>
  );
};
