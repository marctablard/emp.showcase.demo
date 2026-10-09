'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { type AiQuoteItem, mapAiQuoteItems } from '@/lib/common/ai-quote-items';
import { getPublicDefaultCurrency } from '@/lib/common/public-default-env';
import { formatDate } from '@/lib/date-utils';
import type { QuoteDetailsData } from '../types';
import { formatPrice } from '../utils';
import { mapAiQuote } from '../utils/map-ai-quote';
import { WidgetSkeleton } from './WidgetSkeleton';
import {
  AiAddress,
  type AiProductLine,
  AiProductLines,
  AiQuoteStatus,
  AiSpecGrid,
  type AiTotalRow,
  AiTotals,
  AiWidgetFooterLink,
  AiWidgetFrame,
  AiWidgetHeader,
  AiWidgetSection,
} from './ai-widget-kit';

interface QuoteDetailsRendererProps {
  data: QuoteDetailsData | Record<string, unknown>;
}

function quoteItemToLine(item: AiQuoteItem, currency: string): AiProductLine {
  return {
    id: item.productId,
    name: item.name,
    imageUrl: item.image,
    quantity: item.quantity,
    unitPrice: item.unitPrice?.net ?? item.unitPrice?.value ?? item.price,
    totalPrice: item.totalPrice?.net ?? item.totalPrice?.value,
    currency: item.currency || item.unitPrice?.currency || item.totalPrice?.currency || currency,
    href: item.productId ? `/product/${item.productId}` : undefined,
  };
}

export const QuoteDetailsRenderer: React.FC<QuoteDetailsRendererProps> = ({ data }) => {
  const t = useTranslations('account.AiHelper');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const quote = mapAiQuote(data, locale);
  const details = data as QuoteDetailsData;
  const items = mapAiQuoteItems(details.items, locale);

  if (!quote.quoteId && !quote.reference) {
    return <WidgetSkeleton />;
  }

  const currency = quote.currency || details.currency || getPublicDefaultCurrency();
  const totals: AiTotalRow[] = [
    ...(quote.totalNet ? [{ key: 'net', label: t('net'), value: formatPrice(quote.totalNet, currency) }] : []),
    ...(details.shippingCost
      ? [{ key: 'shipping', label: t('shipping'), value: formatPrice(details.shippingCost, currency) }]
      : []),
    ...(quote.totalVat ? [{ key: 'tax', label: tCommon('tax'), value: formatPrice(quote.totalVat, currency) }] : []),
    {
      key: 'total',
      label: t('total'),
      value: formatPrice(quote.totalGross || quote.totalNet || 0, currency),
      emphasized: true,
    },
  ];

  return (
    <div className="space-y-2">
      {details.message ? <p className="px-1 text-sm text-text-body">{details.message}</p> : null}
      <AiWidgetFrame>
        <AiWidgetHeader
          eyebrow={quote.reference ? `#${quote.quoteId}` : undefined}
          title={quote.reference || `#${quote.quoteId}`}
          aside={<AiQuoteStatus status={quote.status} />}
          meta={[
            quote.submittedDate ? `${t('submitted')} ${formatDate(quote.submittedDate, locale)}` : null,
            quote.validTo ? `${t('validUntil')} ${formatDate(quote.validTo, locale)}` : null,
          ]}
        />

        {quote.customerName || details.approverName ? (
          <AiWidgetSection>
            <AiSpecGrid
              entries={[
                { key: 'customer', label: t('customer'), value: quote.customerName },
                { key: 'approver', label: t('approver'), value: details.approverName },
              ]}
            />
          </AiWidgetSection>
        ) : null}

        {items.length > 0 ? (
          <div className="border-b border-border-primary">
            <AiProductLines
              testIdPrefix={`aiQuoteDetails-${quote.quoteId}`}
              lines={items.map((item) => quoteItemToLine(item, currency))}
            />
          </div>
        ) : null}

        <AiWidgetSection>
          <AiTotals rows={totals} />
        </AiWidgetSection>

        {details.shippingAddress || details.shippingMethod ? (
          <AiWidgetSection label={t('shippingInformation')}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {details.shippingAddress ? <AiAddress address={details.shippingAddress} /> : null}
              {details.shippingMethod ? (
                <AiSpecGrid entries={[{ key: 'method', label: t('method'), value: details.shippingMethod }]} />
              ) : null}
            </div>
          </AiWidgetSection>
        ) : null}

        {details.userComment || details.employeeComment ? (
          <AiWidgetSection label={t('comments')}>
            <AiSpecGrid
              entries={[
                { key: 'user', label: t('yourComment'), value: details.userComment },
                { key: 'employee', label: t('employeeComment'), value: details.employeeComment },
              ]}
            />
          </AiWidgetSection>
        ) : null}

        <AiWidgetFooterLink href={`/account/quotes/${quote.quoteId}`} testId="aiQuoteDetails-viewDetails">
          {t('viewFullQuoteDetails')}
        </AiWidgetFooterLink>
      </AiWidgetFrame>
    </div>
  );
};
