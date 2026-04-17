'use client';

import React, { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { QuoteStatusBadge } from '@/components/account/quotes/quote-status-badge';
import { QuoteSummary } from '@/components/account/quotes/quote-summary';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { H2, H3, H4 } from '@/components/ui/h';
import UiLink from '@/components/ui/link';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useQuoteHistory } from '@/hooks/quotes/useQuoteHistory';
import { useQuote } from '@/hooks/quotes/useQuotes';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import type { Quote } from '@/platform/services/model/quote';

interface QuoteDetailsProps {
  quoteId: string;
  initialQuote?: Quote;
}

export function QuoteDetails({ quoteId, initialQuote }: QuoteDetailsProps) {
  const t = useTranslations('account.quoteDetails');
  const router = useRouter();

  // State for confirmation dialogs
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false);
  const [showRejectConfirmation, setShowRejectConfirmation] = useState(false);
  const [showRequestChangeConfirmation, setShowRequestChangeConfirmation] = useState(false);
  const [comment, setComment] = useState('');
  const maxCommentLength = 500;
  const [isProcessing, setIsProcessing] = useState(false);
  const [_processError, setProcessError] = useState<string | null>(null);
  const locale = useLocale();

  const updateQuoteStatus = async (
    quoteId: string,
    status: string,
    comment?: string,
    oldStatus?: string,
  ): Promise<void> => {
    const statusResponse = await fetch('/api/quote/update-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteId,
        status,
        comment,
        locale,
        oldStatus: oldStatus,
      }),
    });

    if (!statusResponse.ok) {
      const errorData = await statusResponse.json();
      throw new Error(errorData.error || 'Failed to update quote status');
    }

    // After successfully updating status, refresh the page to show updated status
    window.location.reload();
  };

  const addQuoteComment = async (quoteId: string, comment: string): Promise<void> => {
    const commentResponse = await fetch('/api/quote/add-comment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        quoteId,
        reference: quote?.reference,
        comment,
      }),
    });

    if (!commentResponse.ok) {
      const errorData = await commentResponse.json();
      throw new Error(errorData.error || 'Failed to add comment to quote');
    }

    // After successfully adding comment, refresh the page to show updated quote
    window.location.reload();
  };

  // Use the hook to fetch the quote if not provided as initialQuote
  const { quote: fetchedQuote, loading, error } = useQuote(initialQuote ? undefined : quoteId);

  // Fetch quote history
  const { history: quoteHistory, loading: historyLoading } = useQuoteHistory(quoteId);

  // Use initialQuote if provided, otherwise use fetched quote
  const quote = initialQuote || fetchedQuote;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatPrice = (price: number | undefined, currency: string | undefined) => {
    if (price === undefined || currency === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(price);
  };

  const getHistoryAction = (fieldChanged: string) => {
    return fieldChanged === '/comment' || fieldChanged.startsWith('/mixins/')
      ? t('commentAdded')
      : t('statusChanged', { currentStatus: quote?.status || 'UNKNOWN' });
  };

  const getHistoryUserName = (historyItem: { fieldChanged: string; userFullName: string }) => {
    if (historyItem.fieldChanged === '/comment') {
      return quote?.approverName || historyItem.userFullName;
    }
    if (historyItem.fieldChanged.startsWith('/mixins/')) {
      return quote?.customerName || historyItem.userFullName;
    }
    return historyItem.userFullName;
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('title')}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center py-8">
          <div className="flex flex-col items-center space-y-2">
            <Spinner color="primary" variant="md" />
            <div>{t('loading')}</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error || !quote) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('title')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-surface-error p-4 rounded-md text-text-error">{error?.message || 'Quote not found'}</div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => router.back()}>{t('backToQuotes')}</Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <div>
      <div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex flex-col px-4 gap-6">
            <div className="flex items-center gap-6 mb-1">
              <H2>{quote.reference || `#${quoteId}`}</H2>
              <QuoteStatusBadge status={quote.status} />
            </div>
            <H4>{t('title')}</H4>
          </div>
          {/* Only show action buttons when confirmation dialogs are not visible and quote status is not ACCEPTED or DECLINED */}
          {!showAcceptConfirmation &&
            !showRejectConfirmation &&
            !showRequestChangeConfirmation &&
            quote.status !== 'ACCEPTED' &&
            quote.status !== 'DECLINED' && (
              <div className="flex space-x-6">
                <Button
                  variant="red"
                  size="small"
                  disabled={!(quote.status === 'OPEN')}
                  onClick={() => {
                    // Show rejection confirmation dialog
                    setShowRejectConfirmation(true);
                  }}
                >
                  {t('reject')}
                </Button>

                <Button
                  variant="secondary"
                  size="small"
                  className={cn('disabled:border-none')}
                  disabled={!(quote.status === 'OPEN')}
                  onClick={() => {
                    setShowRequestChangeConfirmation(true);
                  }}
                >
                  {t('requestChange')}
                </Button>

                <Button
                  variant="primary"
                  size="small"
                  disabled={!(quote.status === 'OPEN')}
                  onClick={() => {
                    setShowAcceptConfirmation(true);
                  }}
                  className="bg-surface-success hover:bg-surface-action-hover-2"
                >
                  {t('accept')}
                </Button>
              </div>
            )}
        </div>
      </div>

      <CardContent className="space-y-6 mt-6">
        {/* Quote acceptance confirmation dialog */}
        {showAcceptConfirmation && (
          <div className="grid grid-cols-1 mb-6 gap-6">
            <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
              <div className="shadow-none rounded-md py-4 h-full gap-2 bg-surface-page p-6">
                <H3 variant="h5" className="mb-2">
                  {t('confirmationTitle')}
                </H3>
                <p className="text-sm text-text-on-disabled mb-4">{t('confirmationDescription')}</p>

                <div className="mb-4">
                  <label htmlFor="accept-comment" className="block text-sm font-medium mb-1">
                    {t('yourComment')}
                  </label>
                  <Textarea
                    id="accept-comment"
                    placeholder={t('commentPlaceholder')}
                    className="w-full h-32 resize-none"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={maxCommentLength}
                  />
                </div>

                <div className="mb-4">
                  {t('termsAgreement')}{' '}
                  <UiLink type="Link" variant="text" href="/privacy-policy">
                    {t('privacyPolicy')}
                  </UiLink>
                  and{' '}
                  <UiLink type="Link" variant="text" href="/terms-and-conditions">
                    {t('termsOfUse')}
                  </UiLink>
                </div>

                <div className="flex space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowAcceptConfirmation(false);
                      setComment('');
                    }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={isProcessing}
                    onClick={async () => {
                      try {
                        setProcessError(null);
                        setIsProcessing(true);

                        await updateQuoteStatus(quoteId, 'ACCEPTED', comment);

                        setShowAcceptConfirmation(false);
                        setComment('');
                      } catch (error) {
                        getLogger().error({ err: error }, 'Failed to process quote');
                        setProcessError(error instanceof Error ? error.message : 'Failed to process quote');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                  >
                    {isProcessing ? t('creating') : t('createOrder')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quote rejection confirmation dialog */}
        {showRejectConfirmation && (
          <div className="grid grid-cols-1 mb-6 gap-6">
            <div className="p-6 rounded-lg bg-surface-action-hover-2 shadow-sm">
              <div className="shadow-none rounded-md py-4 h-full gap-2 bg-surface-page p-6">
                <H3 variant="h5" className="mb-2">
                  {t('rejectConfirmationTitle') || 'Do you want to reject the quote?'}
                </H3>
                <p className="text-sm text-text-placeholders mb-4">
                  {t('rejectConfirmationDescription') ||
                    'If you wish, you can leave a comment to let us know why you are declining this quote. Your feedback helps us improve our offers.'}
                </p>

                <div className="mb-4">
                  <label htmlFor="reject-comment" className="block text-sm font-medium mb-1">
                    {t('yourComment')}
                  </label>
                  <Textarea
                    id="reject-comment"
                    placeholder={t('rejectCommentPlaceholder') || 'Placeholder'}
                    className="w-full h-32 resize-none"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={maxCommentLength}
                  />
                </div>

                <div className="flex space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowRejectConfirmation(false);
                      setComment('');
                    }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="red"
                    disabled={isProcessing}
                    onClick={async () => {
                      try {
                        setProcessError(null);
                        setIsProcessing(true);

                        await updateQuoteStatus(quoteId, 'DECLINED', comment);

                        setShowRejectConfirmation(false);
                        setComment('');
                      } catch (error) {
                        getLogger().error({ err: error }, 'Failed to reject quote');
                        setProcessError(error instanceof Error ? error.message : 'Failed to reject quote');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                  >
                    {isProcessing ? t('rejecting') || 'REJECTING...' : t('rejectQuote') || 'REJECT QUOTE'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quote request change confirmation dialog */}
        {showRequestChangeConfirmation && (
          <div className="grid grid-cols-1 mb-6 gap-6">
            <div className="p-6 rounded-lg bg-surface-action-hover-2 shadow-sm">
              <div className="shadow-none rounded-md py-4 h-full gap-2 bg-surface-page p-6">
                <H3 variant="h5" className="mb-2">
                  {t('requestChangeConfirmationTitle') || 'Do you want to request a change of the quote?'}
                </H3>
                <p className="text-sm text-text-placeholders mb-4">
                  {t('requestChangeConfirmationDescription') || 'Please let us know how what we can do better.'}
                </p>

                <div className="mb-4">
                  <label htmlFor="request-change-comment" className="block text-sm font-medium mb-1">
                    {t('yourComment')}
                  </label>
                  <Textarea
                    id="request-change-comment"
                    placeholder={t('requestChangeCommentPlaceholder') || 'Placeholder'}
                    className="w-full h-32 resize-none"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    maxLength={maxCommentLength}
                  />
                </div>

                <div className="flex space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowRequestChangeConfirmation(false);
                      setComment('');
                    }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={isProcessing || !comment.trim()}
                    onClick={async () => {
                      try {
                        setProcessError(null);
                        setIsProcessing(true);

                        await addQuoteComment(quoteId, comment);

                        setShowRequestChangeConfirmation(false);
                        setComment('');
                      } catch (error) {
                        getLogger().error({ err: error }, 'Failed to add comment to quote');
                        setProcessError(error instanceof Error ? error.message : 'Failed to add comment to quote');
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                  >
                    {isProcessing
                      ? t('requestingChange') || 'REQUESTING CHANGE...'
                      : t('requestChange') || 'REQUEST CHANGE'}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quote details grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('quotationDate')}</p>
            <p className="mt-2 text-text-heading">{formatDate(quote.submittedDate)}</p>
          </div>

          {quote.customerId && (
            <div>
              <p className="text-sm font-medium text-text-placeholders">{t('requestedBy')}</p>
              <p className="mt-2 text-text-heading">{quote.customerName || quote.customerId}</p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('totalAmount')}</p>
            <p className="mt-2 text-text-heading font-semibold">{formatPrice(quote.totalGross, quote.currency)}</p>
          </div>
        </div>

        {/* Quote History Section */}
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr]">
            <p className="col-start-1 font-bold font-headlines">{t('editor')}</p>
            <p className="col-start-2 font-bold font-headlines">{t('action')}</p>
            <p className="col-start-3 font-bold font-headlines">{t('comment')}</p>
            <p className="col-start-4 font-bold font-headlines">{t('date')}</p>
          </div>

          {/* Always show initial quote request as first entry */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr] py-4 border-t border-border-primary">
            <p className="col-start-1">{quote.customerName || 'Unknown User'}</p>
            <p className="col-start-2">{t('initialQuoteRequest')}</p>
            <p className="col-start-3">{'-'}</p>
            <p className="col-start-4">{formatDate(quote.submittedDate)}</p>
          </div>

          {historyLoading ? (
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] py-4 border-t border-border-primary">
              <p className="col-start-1">{t('loadingHistory')}</p>
            </div>
          ) : (
            quoteHistory.map((historyItem) => (
              <div
                key={historyItem.id}
                className="grid grid-cols-[1fr_1fr_1fr_1fr] py-4 border-t border-border-primary"
              >
                <p className="col-start-1">{getHistoryUserName(historyItem)}</p>
                <p className="col-start-2">{getHistoryAction(historyItem.fieldChanged)}</p>
                <p className="col-start-3">{historyItem.comment}</p>
                <p className="col-start-4">{historyItem.modifiedAt}</p>
              </div>
            ))
          )}
        </div>

        {/* Quote Summary Cards */}
        <QuoteSummary quote={quote} />
        {
          <ProductListResolver
            items={quote.items.map((it) => ({
              productId: it.product.id,
              quantity: it.quantity.quantity, // Extract just the numeric quantity value
              unitPrice: it.product.itemPrice.amount,
              currency: it.product.itemPrice.currency,
            }))}
          />
        }
      </CardContent>

      <div>
        <Button variant="neutral" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('backToQuotes')}
        </Button>
      </div>
    </div>
  );
}
