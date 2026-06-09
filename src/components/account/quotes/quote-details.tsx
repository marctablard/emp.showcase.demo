'use client';

import React, { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft } from 'lucide-react';
import { QuoteStatusBadge } from '@/components/account/quotes/quote-status-badge';
import { QuoteSummary } from '@/components/account/quotes/quote-summary';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { H2, H3, H4 } from '@/components/ui/h';
import { Label } from '@/components/ui/label';
import UiLink from '@/components/ui/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useApproverSearch } from '@/hooks/approval/useApproverSearch';
import { useQuoteHistory } from '@/hooks/quotes/useQuoteHistory';
import { useQuote } from '@/hooks/quotes/useQuotes';
import { useRouter } from '@/i18n/navigation';
import { createQuoteApprovalRequest } from '@/lib/approval/contracts';
import { checkApprovalPermitted, createApproval } from '@/lib/client/approval';
import { getQuoteStatusDisplayLabel } from '@/lib/common/quote-status-message-keys';
import { getLogger } from '@/lib/logger/use-logger-client';
import { cn } from '@/lib/utils';
import { ApprovalAlreadyExistsError } from '@/platform/services/approval/errors';
import type { Quote, QuoteHistoryItem } from '@/platform/services/model/quote';

interface QuoteDetailsProps {
  quoteId: string;
  initialQuote?: Quote;
}

interface ApprovalPermissionState {
  approvalId?: string;
  permitted: boolean;
}

const QUOTE_APPROVAL_ACTION = 'CHECKOUT';
const QUOTE_APPROVAL_RESOURCE_TYPE = 'QUOTE';
const QUOTE_DECISION_STATUS = {
  CHANGE: 'IN_PROGRESS',
  DECLINE: 'DECLINED',
} as const;
const QUOTE_DECISION_REASON_OPTIONS = {
  CHANGE: ['WRONG_MATERIAL', 'PROVIDED_PRICE_TO_HIGH', 'DELIVERY_TIME_LATE', 'OTHER'],
  DECLINE: ['PRICE_TOO_HIGH', 'NO_LONGER_NEEDED', 'DELIVERY_TIME_LATE', 'OTHER'],
} as const;

type QuoteDecisionMode = keyof typeof QUOTE_DECISION_REASON_OPTIONS;

export function QuoteDetails({ quoteId, initialQuote }: QuoteDetailsProps) {
  const locale = useLocale();
  const t = useTranslations('account.quoteDetails');
  const tQuoteStatus = useTranslations('account.quoteStatus');
  const tApproval = useTranslations('checkout.approval');
  const router = useRouter();

  // State for confirmation dialogs
  const [showAcceptConfirmation, setShowAcceptConfirmation] = useState(false);
  const [activeDecisionDialog, setActiveDecisionDialog] = useState<QuoteDecisionMode | null>(null);
  const [acceptComment, setAcceptComment] = useState('');
  const [decisionComment, setDecisionComment] = useState('');
  const [decisionReasonCode, setDecisionReasonCode] = useState('');
  const maxCommentLength = 500;
  const [isProcessing, setIsProcessing] = useState(false);
  const [processError, setProcessError] = useState<string | null>(null);
  const [approvalPermission, setApprovalPermission] = useState<ApprovalPermissionState | null>(null);
  const [isCheckingApprovalPermission, setIsCheckingApprovalPermission] = useState(false);
  const [showApprovalInquiryDialog, setShowApprovalInquiryDialog] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState<string | null>(null);
  const [approvalInquiryComment, setApprovalInquiryComment] = useState('');

  const {
    approvers,
    loading: approverSearchLoading,
    error: approverSearchError,
    refetch: refetchApprovers,
  } = useApproverSearch({
    resourceType: QUOTE_APPROVAL_RESOURCE_TYPE,
    resourceId: quoteId,
    action: QUOTE_APPROVAL_ACTION,
  });

  const updateQuoteStatus = async (
    quoteId: string,
    status: string,
    comment?: string,
    reasonCode?: string,
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
        reasonCode,
      }),
    });

    if (!statusResponse.ok) {
      const errorData = await statusResponse.json();
      throw new Error(errorData.error || 'Failed to update quote status');
    }

    // After successfully updating status, refresh the page to show updated status
    window.location.reload();
  };

  // Use the hook to fetch the quote if not provided as initialQuote
  const { quote: fetchedQuote, loading, error } = useQuote(initialQuote ? undefined : quoteId);

  // Fetch quote history
  const { history: quoteHistory, loading: historyLoading } = useQuoteHistory(quoteId);

  // Use initialQuote if provided, otherwise use fetched quote
  const quote = initialQuote || fetchedQuote;

  useEffect(() => {
    if (!quote || quote.status !== 'OPEN') {
      setApprovalPermission(null);
      setIsCheckingApprovalPermission(false);
      return;
    }

    let isCancelled = false;

    const loadApprovalPermission = async (): Promise<void> => {
      try {
        setIsCheckingApprovalPermission(true);

        const permission = await checkApprovalPermitted({
          resourceId: quoteId,
          resourceType: QUOTE_APPROVAL_RESOURCE_TYPE,
          action: QUOTE_APPROVAL_ACTION,
        });

        if (!isCancelled) {
          setApprovalPermission({
            approvalId: permission.approvalId,
            permitted: permission.permitted,
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setApprovalPermission(null);
          getLogger().error({ err: error, quoteId }, 'Failed to load quote approval permission');
        }
      } finally {
        if (!isCancelled) {
          setIsCheckingApprovalPermission(false);
        }
      }
    };

    void loadApprovalPermission();

    return () => {
      isCancelled = true;
    };
  }, [quote, quoteId]);

  useEffect(() => {
    if (!showApprovalInquiryDialog || approvers !== undefined || approverSearchLoading || approverSearchError) {
      return;
    }

    void refetchApprovers();
  }, [showApprovalInquiryDialog, approvers, approverSearchLoading, approverSearchError, refetchApprovers]);

  const handleApprovalInquiryDialogChange = (open: boolean): void => {
    setShowApprovalInquiryDialog(open);
    setProcessError(null);

    if (!open) {
      setSelectedApproverId(null);
      setApprovalInquiryComment('');
    }
  };

  const handleApprovalInquirySubmit = async (): Promise<void> => {
    if (!selectedApproverId) {
      return;
    }

    try {
      setProcessError(null);
      setIsProcessing(true);

      const approval = await createApproval(
        createQuoteApprovalRequest(quoteId, {
          approverId: selectedApproverId,
          comment: approvalInquiryComment.trim() || undefined,
        }),
      );

      setApprovalPermission({
        approvalId: approval.id,
        permitted: false,
      });
      handleApprovalInquiryDialogChange(false);
      router.push(`/account/approval/${approval.id}`);
    } catch (error) {
      if (error instanceof ApprovalAlreadyExistsError) {
        setApprovalPermission({
          approvalId: error.approvalId,
          permitted: false,
        });
        handleApprovalInquiryDialogChange(false);
        router.push(`/account/approval/${error.approvalId}`);
        return;
      }

      getLogger().error({ err: error, quoteId }, 'Failed to create quote approval inquiry');
      const msg = error instanceof Error ? error.message : t('quoteActionFailedDescription');
      setProcessError(msg);
      notify({
        title: t('quoteActionFailedTitle'),
        description: msg,
        type: ToastType.Error,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleQuotePrimaryAction = async (): Promise<void> => {
    try {
      setProcessError(null);
      setIsProcessing(true);

      const permission = await checkApprovalPermitted({
        resourceId: quoteId,
        resourceType: QUOTE_APPROVAL_RESOURCE_TYPE,
        action: QUOTE_APPROVAL_ACTION,
      });

      setApprovalPermission({
        approvalId: permission.approvalId,
        permitted: permission.permitted,
      });

      if (!permission.permitted) {
        if (permission.approvalId) {
          router.push(`/account/approval/${permission.approvalId}`);
          return;
        }

        handleApprovalInquiryDialogChange(true);
        return;
      }

      setShowAcceptConfirmation(true);
    } catch (error) {
      getLogger().error({ err: error, quoteId }, 'Failed to evaluate quote approval requirement');
      const msg = error instanceof Error ? error.message : t('quoteActionFailedDescription');
      setProcessError(msg);
      notify({
        title: t('quoteActionFailedTitle'),
        description: msg,
        type: ToastType.Error,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecisionDialogChange = (nextMode: QuoteDecisionMode | null): void => {
    setActiveDecisionDialog(nextMode);
    setDecisionReasonCode('');
    setDecisionComment('');
    setProcessError(null);
  };

  const handleQuoteDecisionSubmit = async (): Promise<void> => {
    if (!activeDecisionDialog || !decisionReasonCode) {
      return;
    }

    try {
      setProcessError(null);
      setIsProcessing(true);

      await updateQuoteStatus(
        quoteId,
        QUOTE_DECISION_STATUS[activeDecisionDialog],
        decisionComment.trim() || undefined,
        decisionReasonCode,
      );

      handleDecisionDialogChange(null);
    } catch (error) {
      getLogger().error({ err: error, quoteId, reasonCode: decisionReasonCode }, 'Failed to update quote decision');
      const msg = error instanceof Error ? error.message : t('quoteActionFailedDescription');
      setProcessError(msg);
      notify({
        title: t('quoteActionFailedTitle'),
        description: msg,
        type: ToastType.Error,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const formatHistoryDate = (dateString?: string) => {
    if (!dateString || dateString === '-') return '-';
    return new Date(dateString).toLocaleString(locale, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  const getHistoryAction = (historyItem: Pick<QuoteHistoryItem, 'fieldChanged' | 'statusValue'>) => {
    return historyItem.fieldChanged === '/comment' || historyItem.fieldChanged.startsWith('/mixins/')
      ? t('commentAdded')
      : t('statusChanged', {
          currentStatus: historyItem.statusValue
            ? getQuoteStatusDisplayLabel(historyItem.statusValue, tQuoteStatus)
            : 'UNKNOWN',
        });
  };

  const getHistoryUserName = (historyItem: Pick<QuoteHistoryItem, 'userFullName'>) => {
    return historyItem.userFullName;
  };

  const getHistoryReason = (quoteReason?: string): string | undefined => {
    if (!quoteReason) {
      return undefined;
    }

    return t.has(`decisionReasons.${quoteReason}` as any) ? t(`decisionReasons.${quoteReason}` as any) : quoteReason;
  };

  const getHistoryComment = (historyItem: Pick<QuoteHistoryItem, 'comment'>): React.ReactNode => {
    if (!historyItem.comment || historyItem.comment === '-') {
      return '-';
    }

    return historyItem.comment;
  };

  const showInquiryCta = approvalPermission?.permitted === false;
  const primaryActionLabel = showInquiryCta ? t('inquireApproval') : t('accept');
  const isPrimaryActionDisabled = !(quote?.status === 'OPEN') || isProcessing || isCheckingApprovalPermission;

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
      <Dialog open={showApprovalInquiryDialog} onOpenChange={handleApprovalInquiryDialogChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{tApproval('selectApprover')}</DialogTitle>
            <DialogDescription>{tApproval('selectApproverRequired')}</DialogDescription>
          </DialogHeader>

          {approvers && approvers.length > 0 && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto rounded-md border p-2">
              {approvers.map((approver) => (
                <button
                  type="button"
                  key={approver.userId}
                  className={cn(
                    'flex w-full items-center rounded-md p-2 text-left',
                    selectedApproverId === approver.userId ? 'bg-surface-action-hover-2' : 'hover:bg-surface-disabled',
                  )}
                  onClick={() => setSelectedApproverId(approver.userId)}
                  data-testid={`quote-approval-approver-${approver.userId}`}
                >
                  <Avatar className="mr-2 h-8 w-8">
                    <div className="flex h-full w-full items-center justify-center rounded-full bg-surface-action text-text-on-action">
                      {approver.firstName?.charAt(0) || approver.lastName?.charAt(0) || 'U'}
                    </div>
                  </Avatar>
                  <div>
                    <p className="font-medium">
                      {approver.firstName} {approver.lastName}
                    </p>
                    <p className="text-sm text-text-placeholders">{approver.fullName}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {approverSearchLoading && (
            <div className="py-2 text-center">
              <Spinner className="mr-2 inline h-4 w-4" /> {tApproval('loadingApprovers')}
            </div>
          )}

          {!approverSearchLoading && approvers?.length === 0 && !approverSearchError && (
            <div className="py-2 text-center text-text-placeholders">{tApproval('noApproversFound')}</div>
          )}

          {!approverSearchLoading && approverSearchError && (
            <div className="space-y-2 py-4 text-center">
              <p className="text-sm text-text-error">{tApproval('errorFetchingApproversDescription')}</p>
              <Button variant="secondary" size="small" onClick={() => void refetchApprovers()}>
                {tApproval('retry')}
              </Button>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quote-approval-comment">{tApproval('comment')}</Label>
            <Textarea
              id="quote-approval-comment"
              placeholder={tApproval('commentPlaceholder')}
              value={approvalInquiryComment}
              onChange={(e) => setApprovalInquiryComment(e.target.value)}
              rows={3}
              data-testid="quote-approval-comment"
            />
          </div>

          {processError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{processError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button
              variant="secondary"
              disabled={isProcessing}
              onClick={() => handleApprovalInquiryDialogChange(false)}
              data-testid="quote-approval-cancelButton"
            >
              {tApproval('cancel')}
            </Button>
            <Button
              disabled={!selectedApproverId || isProcessing}
              onClick={() => {
                void handleApprovalInquirySubmit();
              }}
              data-testid="quote-approval-submitButton"
            >
              {tApproval('submitApprovalRequest')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={activeDecisionDialog !== null}
        onOpenChange={(open) => handleDecisionDialogChange(open ? activeDecisionDialog : null)}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {activeDecisionDialog === 'DECLINE' ? t('rejectConfirmationTitle') : t('requestChangeConfirmationTitle')}
            </DialogTitle>
            <DialogDescription>
              {activeDecisionDialog === 'DECLINE'
                ? t('rejectConfirmationDescription')
                : t('requestChangeConfirmationDescription')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="quote-decision-reason">{t('decisionReasonLabel')}</Label>
            <Select value={decisionReasonCode} onValueChange={setDecisionReasonCode}>
              <SelectTrigger id="quote-decision-reason" aria-label={t('decisionReasonLabel')}>
                <SelectValue placeholder={t('decisionReasonPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {(activeDecisionDialog ? QUOTE_DECISION_REASON_OPTIONS[activeDecisionDialog] : []).map((reasonCode) => (
                  <SelectItem key={reasonCode} value={reasonCode}>
                    {t(`decisionReasons.${reasonCode}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="quote-decision-comment">{t('yourComment')}</Label>
            <Textarea
              id="quote-decision-comment"
              placeholder={
                activeDecisionDialog === 'DECLINE'
                  ? t('rejectCommentPlaceholder')
                  : t('requestChangeCommentPlaceholder')
              }
              className="min-h-32 resize-none"
              value={decisionComment}
              onChange={(e) => setDecisionComment(e.target.value)}
              maxLength={maxCommentLength}
            />
          </div>

          {processError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{processError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter>
            <Button variant="secondary" disabled={isProcessing} onClick={() => handleDecisionDialogChange(null)}>
              {t('cancel')}
            </Button>
            <Button
              variant={activeDecisionDialog === 'DECLINE' ? 'red' : 'primary'}
              disabled={!decisionReasonCode || isProcessing}
              onClick={() => {
                void handleQuoteDecisionSubmit();
              }}
            >
              {activeDecisionDialog === 'DECLINE'
                ? isProcessing
                  ? t('rejecting')
                  : t('rejectQuote')
                : isProcessing
                  ? t('requestingChange')
                  : t('requestChange')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            !activeDecisionDialog &&
            quote.status !== 'ACCEPTED' &&
            quote.status !== 'DECLINED' && (
              <div className="flex gap-6">
                <Button
                  variant="outlineError"
                  size="small"
                  className={cn('disabled:border-none')}
                  disabled={!(quote.status === 'OPEN')}
                  onClick={() => {
                    handleDecisionDialogChange('DECLINE');
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
                    handleDecisionDialogChange('CHANGE');
                  }}
                >
                  {t('requestChange')}
                </Button>

                <Button
                  variant="outlineSuccess"
                  size="small"
                  className={cn('disabled:border-none')}
                  disabled={isPrimaryActionDisabled}
                  onClick={() => {
                    void handleQuotePrimaryAction();
                  }}
                >
                  {primaryActionLabel}
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
                    value={acceptComment}
                    onChange={(e) => setAcceptComment(e.target.value)}
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

                {processError ? (
                  <Alert variant="destructive" className="mb-4" role="alert">
                    <AlertDescription>{processError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex space-x-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setProcessError(null);
                      setShowAcceptConfirmation(false);
                      setAcceptComment('');
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

                        await updateQuoteStatus(quoteId, 'ACCEPTED', acceptComment);

                        setShowAcceptConfirmation(false);
                        setAcceptComment('');
                      } catch (error) {
                        getLogger().error({ err: error }, 'Failed to process quote');
                        const msg = error instanceof Error ? error.message : t('quoteActionFailedDescription');
                        setProcessError(msg);
                        notify({
                          title: t('quoteActionFailedTitle'),
                          description: msg,
                          type: ToastType.Error,
                        });
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

          {quote.orderId ? (
            <div>
              <p className="text-sm font-medium text-text-placeholders">{t('relatedOrder')}</p>
              <UiLink
                type="Link"
                href={`/account/orders/${quote.orderId}`}
                variant="text"
                className="mt-2 inline-flex underline"
              >
                #{quote.orderId}
              </UiLink>
            </div>
          ) : null}

          {approvalPermission?.approvalId ? (
            <div>
              <p className="text-sm font-medium text-text-placeholders">{t('relatedApproval')}</p>
              <UiLink
                type="Link"
                href={`/account/approval/${approvalPermission.approvalId}`}
                variant="text"
                className="mt-2 inline-flex underline"
              >
                #{approvalPermission.approvalId}
              </UiLink>
            </div>
          ) : null}
        </div>

        {/* Quote History Section */}
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4">
            <p className="col-start-1 font-bold font-headlines">{t('editor')}</p>
            <p className="col-start-2 font-bold font-headlines">{t('action')}</p>
            <p className="col-start-3 font-bold font-headlines">{t('comment')}</p>
            <p className="col-start-4 font-bold font-headlines">{t('reason')}</p>
            <p className="col-start-5 font-bold font-headlines">{t('date')}</p>
          </div>

          {/* Always show initial quote request as first entry */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4 py-4 border-t border-border-primary">
            <p className="col-start-1">{quote.customerName || 'Unknown User'}</p>
            <p className="col-start-2">{t('initialQuoteRequest')}</p>
            <p className="col-start-3">{'-'}</p>
            <p className="col-start-4">{'-'}</p>
            <p className="col-start-5">{formatDate(quote.submittedDate)}</p>
          </div>

          {historyLoading ? (
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4 py-4 border-t border-border-primary">
              <p className="col-start-1">{t('loadingHistory')}</p>
            </div>
          ) : (
            quoteHistory.map((historyItem) => (
              <div
                key={historyItem.id}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr] gap-4 py-4 border-t border-border-primary"
              >
                <p className="col-start-1">{getHistoryUserName(historyItem)}</p>
                <p className="col-start-2">{getHistoryAction(historyItem)}</p>
                <p className="col-start-3">{getHistoryComment(historyItem)}</p>
                <p className="col-start-4">{getHistoryReason(historyItem.quoteReason) || '-'}</p>
                <p className="col-start-5">{formatHistoryDate(historyItem.rawModifiedAt || historyItem.modifiedAt)}</p>
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
