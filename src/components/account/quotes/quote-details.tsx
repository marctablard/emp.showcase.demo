'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronsUpDown, CircleCheck, CircleX, Pencil } from 'lucide-react';
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
import { H3, H4, H5 } from '@/components/ui/h';
import { Label } from '@/components/ui/label';
import UiLink from '@/components/ui/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useApproverSearch } from '@/hooks/approval/useApproverSearch';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import { useQuoteHistory } from '@/hooks/quotes/useQuoteHistory';
import { useQuote } from '@/hooks/quotes/useQuotes';
import { useRouter } from '@/i18n/navigation';
import { createQuoteApprovalRequest } from '@/lib/approval/contracts';
import { checkApprovalPermitted, createApproval } from '@/lib/client/approval';
import { getQuoteStatusDisplayLabel } from '@/lib/common/quote-status-message-keys';
import { isQuoteStatusValue } from '@/lib/common/status-tag-variants';
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
const QUOTE_STATUS_ERROR_MARKER = 'failed with upstream status';
const QUOTE_DECISION_STATUS = {
  CHANGE: 'IN_PROGRESS',
  DECLINE: 'DECLINED',
} as const;
const QUOTE_DECISION_REASON_OPTIONS = {
  CHANGE: ['WRONG_MATERIAL', 'PROVIDED_PRICE_TO_HIGH', 'DELIVERY_TIME_LATE', 'OTHER'],
  DECLINE: ['PRICE_TOO_HIGH', 'NO_LONGER_NEEDED', 'DELIVERY_TIME_LATE', 'OTHER'],
} as const;

function getApproverSortValue(approver: {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  userId: string;
}): string {
  return approver.firstName?.trim() || approver.fullName?.trim() || approver.lastName?.trim() || approver.userId;
}

function trimQuoteStatusErrorMessage(message: string): string {
  const markerIndex = message.toLowerCase().indexOf(QUOTE_STATUS_ERROR_MARKER);

  if (markerIndex === -1) {
    return message.trim();
  }

  const descriptionStartIndex = message.indexOf(':', markerIndex);

  if (descriptionStartIndex === -1) {
    return message.trim();
  }

  return message.slice(descriptionStartIndex + 1).trim();
}

function getHistoryActionLabel(
  historyItem: Pick<QuoteHistoryItem, 'fieldChanged' | 'statusValue'>,
  t: ReturnType<typeof useTranslations<'account.quoteDetails'>>,
  tQuoteStatus: ReturnType<typeof useTranslations<'account.quoteStatus'>>,
): string {
  return historyItem.fieldChanged === '/comment' || historyItem.fieldChanged.startsWith('/mixins/')
    ? t('commentAdded')
    : t('statusChanged', {
        currentStatus: historyItem.statusValue
          ? getQuoteStatusDisplayLabel(historyItem.statusValue, tQuoteStatus)
          : 'UNKNOWN',
      });
}

type QuoteDetailsTranslate = ReturnType<typeof useTranslations<'account.quoteDetails'>>;

function getHistoryReason(quoteReason: string | undefined, t: QuoteDetailsTranslate): string | undefined {
  if (!quoteReason) {
    return undefined;
  }

  return t.has(`decisionReasons.${quoteReason}` as any) ? t(`decisionReasons.${quoteReason}` as any) : quoteReason;
}

function getHistoryComment(historyItem: Pick<QuoteHistoryItem, 'comment'>): string {
  if (!historyItem.comment || historyItem.comment === '-') {
    return '-';
  }

  return historyItem.comment;
}

function getHistoryCommentWithReason(historyItem: QuoteHistoryItem, t: QuoteDetailsTranslate): string {
  const comment = getHistoryComment(historyItem);
  const reason = getHistoryReason(historyItem.quoteReason, t);

  if (!reason) {
    return comment;
  }

  return comment === '-' ? reason : `${comment} (${reason})`;
}

type QuoteDecisionMode = keyof typeof QUOTE_DECISION_REASON_OPTIONS;

async function loadQuoteApprovalPermission({
  quote,
  quoteId,
  isCancelled,
  setApprovalPermission,
  setIsCheckingApprovalPermission,
}: {
  quote: Quote | null | undefined;
  quoteId: string;
  isCancelled: () => boolean;
  setApprovalPermission: React.Dispatch<React.SetStateAction<ApprovalPermissionState | null>>;
  setIsCheckingApprovalPermission: React.Dispatch<React.SetStateAction<boolean>>;
}): Promise<void> {
  if (quote?.status !== 'OPEN') {
    setApprovalPermission(null);
    setIsCheckingApprovalPermission(false);
    return;
  }

  try {
    setIsCheckingApprovalPermission(true);

    const permission = await checkApprovalPermitted({
      resourceId: quoteId,
      resourceType: QUOTE_APPROVAL_RESOURCE_TYPE,
      action: QUOTE_APPROVAL_ACTION,
    });

    if (!isCancelled()) {
      setApprovalPermission({
        approvalId: permission.approvalId,
        permitted: permission.permitted,
      });
    }
  } catch (error) {
    if (!isCancelled()) {
      setApprovalPermission(null);
      getLogger().error({ err: error, quoteId }, 'Failed to load quote approval permission');
    }
  } finally {
    if (!isCancelled()) {
      setIsCheckingApprovalPermission(false);
    }
  }
}

function shouldFetchApprovers(params: {
  showApprovalInquiryDialog: boolean;
  approvers: ReturnType<typeof useApproverSearch>['approvers'];
  approverSearchLoading: boolean;
  approverSearchError: ReturnType<typeof useApproverSearch>['error'];
}): boolean {
  const { showApprovalInquiryDialog, approvers, approverSearchLoading, approverSearchError } = params;

  return showApprovalInquiryDialog && approvers === undefined && !approverSearchLoading && !approverSearchError;
}

function formatDate(dateString: string | undefined, locale: string): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatHistoryDate(dateString: string | undefined, locale: string): string {
  if (!dateString || dateString === '-') return '-';
  return new Date(dateString).toLocaleString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatPrice(price: number | undefined, currency: string | undefined): string {
  if (price === undefined || currency === undefined) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(price);
}

async function runQuotePrimaryAction(deps: {
  quoteId: string;
  t: QuoteDetailsTranslate;
  router: ReturnType<typeof useRouter>;
  setProcessError: (v: string | null) => void;
  setIsProcessing: (v: boolean) => void;
  setApprovalPermission: (v: ApprovalPermissionState | null) => void;
  setShowAcceptConfirmation: (v: boolean) => void;
  openApprovalInquiryDialog: () => void;
}): Promise<void> {
  const {
    quoteId,
    t,
    router,
    setProcessError,
    setIsProcessing,
    setApprovalPermission,
    setShowAcceptConfirmation,
    openApprovalInquiryDialog,
  } = deps;

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

    if (permission.permitted) {
      setShowAcceptConfirmation(true);
      return;
    }

    if (permission.approvalId) {
      router.push(`/account/approval/${permission.approvalId}`);
      return;
    }

    openApprovalInquiryDialog();
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
}

async function runQuoteApprovalInquiry(deps: {
  selectedApproverId: string | null;
  quoteId: string;
  approvalInquiryComment: string;
  t: QuoteDetailsTranslate;
  router: ReturnType<typeof useRouter>;
  setProcessError: (v: string | null) => void;
  setIsProcessing: (v: boolean) => void;
  setApprovalPermission: (v: ApprovalPermissionState | null) => void;
  closeApprovalInquiryDialog: () => void;
}): Promise<void> {
  const {
    selectedApproverId,
    quoteId,
    approvalInquiryComment,
    t,
    router,
    setProcessError,
    setIsProcessing,
    setApprovalPermission,
    closeApprovalInquiryDialog,
  } = deps;

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
    closeApprovalInquiryDialog();
    router.push(`/account/approval/${approval.id}`);
  } catch (error) {
    if (error instanceof ApprovalAlreadyExistsError) {
      setApprovalPermission({
        approvalId: error.approvalId,
        permitted: false,
      });
      closeApprovalInquiryDialog();
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
}

async function runQuoteDecisionSubmit(deps: {
  activeDecisionDialog: QuoteDecisionMode | null;
  decisionReasonCode: string;
  decisionComment: string;
  quoteId: string;
  t: QuoteDetailsTranslate;
  updateQuoteStatus: (quoteId: string, status: string, comment?: string, reasonCode?: string) => Promise<void>;
  setProcessError: (v: string | null) => void;
  setIsProcessing: (v: boolean) => void;
  closeDecisionDialog: () => void;
}): Promise<void> {
  const {
    activeDecisionDialog,
    decisionReasonCode,
    decisionComment,
    quoteId,
    t,
    updateQuoteStatus,
    setProcessError,
    setIsProcessing,
    closeDecisionDialog,
  } = deps;

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

    closeDecisionDialog();
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
}

async function updateQuoteStatus(
  quoteId: string,
  status: string,
  comment?: string,
  reasonCode?: string,
): Promise<void> {
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
}

async function runQuoteAccept(deps: {
  quoteId: string;
  acceptComment: string;
  t: QuoteDetailsTranslate;
  setProcessError: (v: string | null) => void;
  setIsProcessing: (v: boolean) => void;
  setShowAcceptConfirmation: (v: boolean) => void;
  setAcceptComment: (v: string) => void;
}): Promise<void> {
  const { quoteId, acceptComment, t, setProcessError, setIsProcessing, setShowAcceptConfirmation, setAcceptComment } =
    deps;

  try {
    setProcessError(null);
    setIsProcessing(true);

    await updateQuoteStatus(quoteId, 'ACCEPTED', acceptComment);

    setShowAcceptConfirmation(false);
    setAcceptComment('');
  } catch (error) {
    getLogger().error({ err: error }, 'Failed to process quote');
    const msg = error instanceof Error ? trimQuoteStatusErrorMessage(error.message) : t('quoteActionFailedDescription');
    notify({
      title: t('quoteActionFailedTitle'),
      description: msg,
      type: ToastType.Error,
    });
  } finally {
    setIsProcessing(false);
  }
}

function getQuotePrimaryActionPresentation(deps: {
  quote: Quote | null | undefined;
  approvalPermission: ApprovalPermissionState | null;
  isProcessing: boolean;
  isCheckingApprovalPermission: boolean;
  t: QuoteDetailsTranslate;
}): {
  showInquiryCta: boolean;
  primaryActionLabel: string;
  isPrimaryActionDisabled: boolean;
} {
  const { quote, approvalPermission, isProcessing, isCheckingApprovalPermission, t } = deps;
  const showInquiryCta = quote?.status === 'OPEN' && approvalPermission?.permitted === false;
  const primaryActionLabel = showInquiryCta ? t('inquireApproval') : t('accept');
  const isPrimaryActionDisabled = quote?.status !== 'OPEN' || isProcessing || isCheckingApprovalPermission;

  return {
    showInquiryCta,
    primaryActionLabel,
    isPrimaryActionDisabled,
  };
}

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
  const acceptCommentRef = useRef<HTMLTextAreaElement | null>(null);

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

  const sortedApprovers = useMemo(() => {
    if (!approvers) {
      return undefined;
    }

    return [...approvers].sort((left, right) => {
      const firstNameComparison = getApproverSortValue(left).localeCompare(getApproverSortValue(right), locale, {
        sensitivity: 'base',
      });

      if (firstNameComparison !== 0) {
        return firstNameComparison;
      }

      return left.userId.localeCompare(right.userId, locale, { sensitivity: 'base' });
    });
  }, [approvers, locale]);

  // Use the hook to fetch the quote if not provided as initialQuote
  const { quote: fetchedQuote, loading, error } = useQuote(initialQuote ? undefined : quoteId);

  // Fetch quote history
  const { history: quoteHistory, loading: historyLoading } = useQuoteHistory(quoteId);

  // Use initialQuote if provided, otherwise use fetched quote
  const quote = initialQuote || fetchedQuote;

  useEffect(() => {
    let isCancelled = false;

    const cancelStart = startEffectTask(() =>
      loadQuoteApprovalPermission({
        quote,
        quoteId,
        isCancelled: () => isCancelled,
        setApprovalPermission,
        setIsCheckingApprovalPermission,
      }),
    );

    return () => {
      isCancelled = true;
      cancelStart();
    };
  }, [quote, quoteId]);

  useEffect(() => {
    if (
      !shouldFetchApprovers({
        showApprovalInquiryDialog,
        approvers,
        approverSearchLoading,
        approverSearchError,
      })
    ) {
      return;
    }

    void refetchApprovers();
  }, [showApprovalInquiryDialog, approvers, approverSearchLoading, approverSearchError, refetchApprovers]);

  useEffect(() => {
    if (!showAcceptConfirmation) {
      return;
    }

    acceptCommentRef.current?.focus();
  }, [showAcceptConfirmation]);

  const handleApprovalInquiryDialogChange = (open: boolean): void => {
    setShowApprovalInquiryDialog(open);
    setProcessError(null);

    if (!open) {
      setSelectedApproverId(null);
      setApprovalInquiryComment('');
    }
  };

  const handleApprovalInquirySubmit = async (): Promise<void> => {
    await runQuoteApprovalInquiry({
      selectedApproverId,
      quoteId,
      approvalInquiryComment,
      t,
      router,
      setProcessError,
      setIsProcessing,
      setApprovalPermission,
      closeApprovalInquiryDialog: () => handleApprovalInquiryDialogChange(false),
    });
  };

  const handleQuotePrimaryAction = async (): Promise<void> => {
    await runQuotePrimaryAction({
      quoteId,
      t,
      router,
      setProcessError,
      setIsProcessing,
      setApprovalPermission,
      setShowAcceptConfirmation,
      openApprovalInquiryDialog: () => handleApprovalInquiryDialogChange(true),
    });
  };

  const handleDecisionDialogChange = (nextMode: QuoteDecisionMode | null): void => {
    setActiveDecisionDialog(nextMode);
    setDecisionReasonCode('');
    setDecisionComment('');
    setProcessError(null);
  };

  const handleQuoteDecisionSubmit = async (): Promise<void> => {
    await runQuoteDecisionSubmit({
      activeDecisionDialog,
      decisionReasonCode,
      decisionComment,
      quoteId,
      t,
      updateQuoteStatus,
      setProcessError,
      setIsProcessing,
      closeDecisionDialog: () => handleDecisionDialogChange(null),
    });
  };

  const getHistoryAction = (historyItem: Pick<QuoteHistoryItem, 'fieldChanged' | 'statusValue'>) =>
    getHistoryActionLabel(historyItem, t, tQuoteStatus);

  const getHistoryUserName = (historyItem: Pick<QuoteHistoryItem, 'userFullName'>) => {
    return historyItem.userFullName;
  };

  const { showInquiryCta, primaryActionLabel, isPrimaryActionDisabled } = getQuotePrimaryActionPresentation({
    quote,
    approvalPermission,
    isProcessing,
    isCheckingApprovalPermission,
    t,
  });
  void showInquiryCta;

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

          {sortedApprovers && sortedApprovers.length > 0 && (
            <div className="space-y-2 max-h-[200px] overflow-y-auto rounded-md border p-2">
              {sortedApprovers.map((approver) => (
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

      <div className="flex flex-wrap items-center gap-6 px-6">
        <div className="flex items-center gap-6">
          <H3>
            {t('headerTitle')}: {quote.reference || quoteId}
          </H3>
          <QuoteStatusBadge status={quote.status} />
        </div>
        {!showAcceptConfirmation && !activeDecisionDialog && (
          <div className="ml-auto flex flex-wrap items-center justify-end gap-6">
            <Button
              variant="outlineError"
              size="small"
              className={cn('gap-2 disabled:border-none')}
              disabled={!(quote.status === 'OPEN')}
              onClick={() => {
                handleDecisionDialogChange('DECLINE');
              }}
            >
              <CircleX className="h-6 w-6" />
              {t('reject')}
            </Button>

            <Button
              variant="outlineSuccess"
              size="small"
              className={cn('gap-2 disabled:border-none')}
              disabled={isPrimaryActionDisabled}
              onClick={() => {
                void handleQuotePrimaryAction();
              }}
            >
              <CircleCheck className="h-6 w-6" />
              {primaryActionLabel}
            </Button>

            <Button
              variant="secondary"
              size="small"
              className={cn('gap-2 disabled:border-none')}
              disabled={quote.status !== 'OPEN'}
              onClick={() => {
                handleDecisionDialogChange('CHANGE');
              }}
            >
              <Pencil className="h-6 w-6" />
              {t('requestChange')}
            </Button>
          </div>
        )}
      </div>

      <CardContent className="space-y-6 mt-6">
        <div className="rounded-md bg-surface-primary p-6 shadow-sm">
          <div className="flex flex-col gap-6">
            <H4>{t('title')}</H4>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex flex-col gap-1">
                <H5>{t('quotationDate')}</H5>
                <span className="text-base font-body text-text-body">{formatDate(quote.submittedDate, locale)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <H5>{t('totalAmount')}</H5>
                <span className="text-base font-body text-text-body">
                  {formatPrice(quote.totalGross, quote.currency)}
                </span>
              </div>
              {quote.customerId && (
                <div className="flex flex-col gap-1">
                  <H5>{t('requestedBy')}</H5>
                  <span className="text-base font-body text-text-body">{quote.customerName || quote.customerId}</span>
                </div>
              )}
              {quote.orderId ? (
                <div className="flex flex-col gap-1">
                  <H5>{t('relatedOrder')}</H5>
                  <UiLink
                    type="Link"
                    href={`/account/orders/${quote.orderId}`}
                    variant="textNoUnderline"
                    className="w-fit"
                  >
                    {quote.orderId}
                  </UiLink>
                </div>
              ) : null}
              {approvalPermission?.approvalId ? (
                <div className="flex flex-col gap-1">
                  <H5>{t('relatedApproval')}</H5>
                  <UiLink
                    type="Link"
                    href={`/account/approval/${approvalPermission.approvalId}`}
                    variant="textNoUnderline"
                    className="w-fit"
                  >
                    {approvalPermission.approvalId}
                  </UiLink>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {(showAcceptConfirmation || activeDecisionDialog) && (
          <div className="p-6 rounded-md bg-surface-action-hover-2 shadow-sm">
            <div
              className={cn(
                'shadow-none rounded-md py-4 h-full bg-surface-page p-6',
                activeDecisionDialog === 'CHANGE' && 'border-2 border-border-action',
              )}
            >
              {showAcceptConfirmation && (
                <>
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
                      ref={acceptCommentRef}
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
                      onClick={() => {
                        void runQuoteAccept({
                          quoteId,
                          acceptComment,
                          t,
                          setProcessError,
                          setIsProcessing,
                          setShowAcceptConfirmation,
                          setAcceptComment,
                        });
                      }}
                    >
                      {isProcessing ? t('creating') : t('createOrder')}
                    </Button>
                  </div>
                </>
              )}

              {activeDecisionDialog === 'DECLINE' && (
                <div className="flex flex-col gap-6">
                  <div>
                    <H4>{t('rejectConfirmationTitle')}</H4>
                    <p className="mt-2 text-base font-body text-text-body">{t('rejectConfirmationDescription')}</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quote-decision-reason">{t('decisionReasonLabel')}</Label>
                    <Select value={decisionReasonCode} onValueChange={setDecisionReasonCode}>
                      <SelectTrigger id="quote-decision-reason" aria-label={t('decisionReasonLabel')}>
                        <SelectValue placeholder={t('decisionReasonPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {QUOTE_DECISION_REASON_OPTIONS.DECLINE.map((reasonCode) => (
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
                      placeholder={t('rejectCommentPlaceholder')}
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

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      disabled={isProcessing}
                      onClick={() => handleDecisionDialogChange(null)}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      variant="red"
                      disabled={!decisionReasonCode || isProcessing}
                      onClick={() => {
                        void handleQuoteDecisionSubmit();
                      }}
                    >
                      {isProcessing ? t('rejecting') : t('rejectQuote')}
                    </Button>
                  </div>
                </div>
              )}

              {activeDecisionDialog === 'CHANGE' && (
                <div className="flex flex-col gap-6">
                  <div>
                    <H4>{t('requestChangeConfirmationTitle')}</H4>
                    <p className="mt-2 text-base font-body text-text-body">
                      {t('requestChangeConfirmationDescription')}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quote-change-reason">{t('decisionReasonLabel')}</Label>
                    <Select value={decisionReasonCode} onValueChange={setDecisionReasonCode}>
                      <SelectTrigger id="quote-change-reason" aria-label={t('decisionReasonLabel')}>
                        <SelectValue placeholder={t('decisionReasonPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {QUOTE_DECISION_REASON_OPTIONS.CHANGE.map((reasonCode) => (
                          <SelectItem key={reasonCode} value={reasonCode}>
                            {t(`decisionReasons.${reasonCode}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="quote-change-comment">{t('yourComment')}</Label>
                    <Textarea
                      id="quote-change-comment"
                      placeholder={t('requestChangeCommentPlaceholder')}
                      className="min-h-32 resize-none"
                      value={decisionComment}
                      onChange={(event) => setDecisionComment(event.target.value)}
                      maxLength={maxCommentLength}
                    />
                  </div>

                  {processError ? (
                    <Alert variant="destructive" role="alert">
                      <AlertDescription>{processError}</AlertDescription>
                    </Alert>
                  ) : null}

                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="secondary"
                      disabled={isProcessing}
                      onClick={() => handleDecisionDialogChange(null)}
                    >
                      {t('cancel')}
                    </Button>
                    <Button
                      disabled={!decisionReasonCode || isProcessing}
                      onClick={() => {
                        void handleQuoteDecisionSubmit();
                      }}
                    >
                      {isProcessing ? t('requestingChange') : t('requestChange')}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="rounded-md bg-surface-primary p-4 shadow-sm">
          <div className="flex flex-col gap-6">
            <H4>{t('quoteHistory')}</H4>
            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid h-14 grid-cols-5 gap-4 px-2">
                  {[t('changeDate'), t('event'), t('changedBy'), t('status'), t('comment')].map((heading) => (
                    <div
                      key={heading}
                      className="flex items-center gap-2 text-2xl font-bold font-headlines text-text-headings"
                    >
                      {heading}
                      <ChevronsUpDown aria-hidden="true" className="h-4 w-4 text-text-on-disabled" />
                    </div>
                  ))}
                </div>

                <div className="grid min-h-15 grid-cols-5 gap-4 border-t border-border-primary px-2 py-4 text-base font-body text-text-body">
                  <p>{formatDate(quote.submittedDate, locale)}</p>
                  <p>{t('initialQuoteRequest')}</p>
                  <p>{quote.customerName || 'Unknown User'}</p>
                  <p>-</p>
                  <p>{quote.userComment || '-'}</p>
                </div>

                {historyLoading ? (
                  <div className="grid min-h-15 grid-cols-5 gap-4 border-t border-border-primary px-2 py-4 text-base font-body text-text-body">
                    <p>{t('loadingHistory')}</p>
                  </div>
                ) : (
                  quoteHistory.map((historyItem) => (
                    <div
                      key={historyItem.id}
                      className="grid min-h-15 grid-cols-5 gap-4 border-t border-border-primary px-2 py-4 text-base font-body text-text-body"
                    >
                      <p>{formatHistoryDate(historyItem.rawModifiedAt || historyItem.modifiedAt, locale)}</p>
                      <p>{getHistoryAction(historyItem)}</p>
                      <p>{getHistoryUserName(historyItem)}</p>
                      <div>
                        {historyItem.statusValue && isQuoteStatusValue(historyItem.statusValue) ? (
                          <QuoteStatusBadge status={historyItem.statusValue} />
                        ) : (
                          '-'
                        )}
                      </div>
                      <p>{getHistoryCommentWithReason(historyItem, t)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quote Summary Cards */}
        <QuoteSummary quote={quote} />
        {
          <ProductListResolver
            locale={locale}
            showGrossUnderNet
            presentationConfig={{
              labels: {
                product: t('product'),
                quantity: t('quantity'),
                unitPrice: t('unitPrice'),
              },
              showGrossSecondary: true,
            }}
            items={quote.items.map((it) => ({
              productId: it.product.id,
              quantity: it.quantity.quantity, // Extract just the numeric quantity value
              unitPrice: it.product.itemPrice.amount,
              currency: it.product.itemPrice.currency,
              grossUnitPrice: it.product.itemPrice.grossValue,
              netUnitPrice: it.product.itemPrice.netValue,
            }))}
          />
        }
      </CardContent>
    </div>
  );
}
