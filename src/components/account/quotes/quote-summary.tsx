'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { List, NotebookPen, ReceiptText, Truck } from 'lucide-react';
import { QuoteDetailField } from '@/components/account/quotes/quote-detail-fields';
import { SummaryRow } from '@/components/ui/summary-card';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';
import type { Quote } from '@/platform/services/model/quote';

interface QuoteSummaryProps {
  quote: Quote;
}

function QuoteSummaryTile({
  heading,
  icon,
  children,
  className,
}: {
  heading: string;
  icon: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('rounded-md border border-border-primary/50 bg-surface-action-hover-2/60 p-4 shadow-sm', className)}
    >
      <div className="mb-2.5 flex items-center gap-2 border-b border-border-primary/40 pb-2">
        <span className="text-text-action [&_svg]:h-4 [&_svg]:w-4">{icon}</span>
        <h3 className="text-sm font-bold font-headlines text-text-heading">{heading}</h3>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function QuoteSummary({ quote }: QuoteSummaryProps) {
  const t = useTranslations('account.quoteDetails');

  const currency = quote.currency || getPublicDefaultCurrency();
  const itemCount = quote.items?.reduce((total, item) => total + (item.quantity.quantity || 0), 0) || 0;
  const fmt = (amount: number) => `${amount.toFixed(2)} ${currency}`;
  const quotedTotal = quote.totalNet + quote.totalVat + quote.shippingCost;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <QuoteSummaryTile heading={t('details')} icon={<NotebookPen />}>
        <QuoteDetailField label={t('quotationDate')}>{formatDate(quote.submittedDate)}</QuoteDetailField>
        <QuoteDetailField label={t('requestedBy')}>{quote.customerName || quote.customerId}</QuoteDetailField>
        <QuoteDetailField label={t('numberOfProducts')}>{itemCount}</QuoteDetailField>
      </QuoteSummaryTile>

      <QuoteSummaryTile heading={t('basePrice')} icon={<List />}>
        <SummaryRow label={t('netValue')} mutedLabel>
          {fmt(quote.totalNet)}
        </SummaryRow>
        <SummaryRow label={t('vat')} mutedLabel>
          {fmt(quote.totalVat)}
        </SummaryRow>
        <SummaryRow label={t('deliveryCosts')} mutedLabel>
          {fmt(quote.shippingCost)}
        </SummaryRow>
        <SummaryRow label={t('baseTotal')} strong className="border-t border-border-primary/40 pt-2 mt-1">
          {fmt(quotedTotal)}
        </SummaryRow>
      </QuoteSummaryTile>

      <QuoteSummaryTile heading={t('transport')} icon={<Truck />}>
        <QuoteDetailField label={t('transportCondition')}>{quote.shippingMethod}</QuoteDetailField>
        <QuoteDetailField label={t('deliveryAddress')}>
          {quote.shippingAddress.contactName}
          <br />
          {quote.shippingAddress.street}
          <br />
          {quote.shippingAddress.zipCode} {quote.shippingAddress.city}
          <br />
          {quote.shippingAddress.country}
        </QuoteDetailField>
      </QuoteSummaryTile>

      <QuoteSummaryTile heading={t('quotedPrice')} icon={<ReceiptText />}>
        <SummaryRow label={t('netValue')} mutedLabel>
          {fmt(quote.totalNet)}
        </SummaryRow>
        <SummaryRow label={t('vat')} mutedLabel>
          {fmt(quote.totalVat)}
        </SummaryRow>
        <SummaryRow label={t('transportCost')} mutedLabel>
          {fmt(quote.shippingCost)}
        </SummaryRow>
        <SummaryRow label={t('quotedTotal')} strong className="border-t border-border-primary/40 pt-2 mt-1">
          {fmt(quotedTotal)}
        </SummaryRow>
      </QuoteSummaryTile>
    </div>
  );
}
