'use client';

import { useTranslations } from 'next-intl';
import { QuoteDetailField } from '@/components/account/quotes/quote-detail-fields';
import { QuoteStatusBadge } from '@/components/account/quotes/quote-status-badge';
import { Button } from '@/components/ui/button';
import UiLink from '@/components/ui/link';
import type { Quote } from '@/platform/services/model/quote';

interface QuoteDetailsHeaderProps {
  quote: Quote;
  quoteId: string;
  formatDate: (dateString?: string) => string;
  formatPrice: (price: number | undefined, currency: string | undefined) => string;
  approvalId?: string;
  showActions: boolean;
  primaryActionLabel: string;
  isPrimaryActionDisabled: boolean;
  onReject: () => void;
  onRequestChange: () => void;
  onPrimaryAction: () => void;
}

export function QuoteDetailsHeader({
  quote,
  quoteId,
  formatDate,
  formatPrice,
  approvalId,
  showActions,
  primaryActionLabel,
  isPrimaryActionDisabled,
  onReject,
  onRequestChange,
  onPrimaryAction,
}: QuoteDetailsHeaderProps) {
  const t = useTranslations('account.quoteDetails');
  const actionsEnabled = quote.status === 'OPEN';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-text-placeholders">{t('title')}</p>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold font-headlines text-text-heading sm:text-2xl">
              {quote.reference || `#${quoteId}`}
            </h1>
            <QuoteStatusBadge status={quote.status} />
          </div>
        </div>

        {showActions && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outlineError"
              size="small"
              className="disabled:border-none"
              disabled={!actionsEnabled}
              onClick={onReject}
            >
              {t('reject')}
            </Button>
            <Button
              variant="secondary"
              size="small"
              className="disabled:border-none"
              disabled={!actionsEnabled}
              onClick={onRequestChange}
            >
              {t('requestChange')}
            </Button>
            <Button
              variant="outlineSuccess"
              size="small"
              className="disabled:border-none"
              disabled={isPrimaryActionDisabled}
              onClick={onPrimaryAction}
            >
              {primaryActionLabel}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-md border border-border-primary/50 bg-surface-action-hover-2/40 p-4 sm:grid-cols-3 lg:grid-cols-4">
        <QuoteDetailField label={t('quotationDate')}>{formatDate(quote.submittedDate)}</QuoteDetailField>

        {quote.customerId ? (
          <QuoteDetailField label={t('requestedBy')}>{quote.customerName || quote.customerId}</QuoteDetailField>
        ) : null}

        <QuoteDetailField label={t('totalAmount')} emphasize>
          {formatPrice(quote.totalGross, quote.currency)}
        </QuoteDetailField>

        {quote.orderId ? (
          <QuoteDetailField label={t('relatedOrder')}>
            <UiLink type="Link" href={`/account/orders/${quote.orderId}`} variant="text" className="underline">
              #{quote.orderId}
            </UiLink>
          </QuoteDetailField>
        ) : null}

        {approvalId ? (
          <QuoteDetailField label={t('relatedApproval')}>
            <UiLink type="Link" href={`/account/approval/${approvalId}`} variant="text" className="underline">
              #{approvalId}
            </UiLink>
          </QuoteDetailField>
        ) : null}
      </div>
    </div>
  );
}
