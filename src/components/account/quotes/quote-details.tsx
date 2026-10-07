'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowDown, ArrowUp, CircleCheck, CircleX, Pencil } from 'lucide-react';
import { getApprovalHref } from '@/components/account/approvals/approval-routing';
import {
  quoteHasItemDiscounts,
  resolveItemDiscountPercent,
  resolveQuotedGrossUnitPrice,
  resolveQuotedNetUnitPrice,
} from '@/components/account/quotes/quote-price-summary';
import { QuoteStatusBadge } from '@/components/account/quotes/quote-status-badge';
import { QuoteSummary } from '@/components/account/quotes/quote-summary';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
  AccountSectionLabel,
} from '@/components/account/shared/account-detail';
import { ApproverSelectList } from '@/components/approval/approver-select-list';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import UiLink from '@/components/ui/link';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useApproval } from '@/hooks/approval/useApproval';
import { useApproverSearch } from '@/hooks/approval/useApproverSearch';
import { startEffectTask } from '@/hooks/common/start-effect-task';
import useCustomer from '@/hooks/customer/useCustomer';
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

type QuoteDetailsTranslate = ReturnType<typeof useTranslations<'account.quoteDetails'>>;

function isQuoteDetailsReady(
  loading: boolean,
  error: Error | null | undefined,
  quote: Quote | null | undefined,
): quote is Quote {
  return !loading && !error && Boolean(quote);
}

function renderQuoteDetailsUnavailableState(deps: {
  loading: boolean;
  error: Error | null | undefined;
  t: QuoteDetailsTranslate;
  onBack: () => void;
}): React.ReactNode {
  const { loading, error, t, onBack } = deps;

  if (loading) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4 border border-border-primary bg-surface-page p-6 text-center">
      <p className="text-text-error">{error?.message || 'Quote not found'}</p>
      <Button onClick={onBack} data-testid="quote-backButton">
        {t('backToQuotes')}
      </Button>
    </div>
  );
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

function sortApproversByLocale<T extends { userId: string; firstName?: string; lastName?: string; fullName?: string }>(
  approvers: T[] | null | undefined,
  locale: string,
): T[] | undefined {
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
  t: QuoteDetailsTranslate,
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

type QuoteHistorySortDirection = 'asc' | 'desc';

type QuoteHistoryDisplayRow =
  { kind: 'initial'; dateMs: number } | { kind: 'item'; dateMs: number; item: QuoteHistoryItem };

function getHistoryItemDateMs(item: Pick<QuoteHistoryItem, 'rawModifiedAt' | 'modifiedAt'>): number {
  const dateString = item.rawModifiedAt || item.modifiedAt;
  if (!dateString || dateString === '-') {
    return 0;
  }
  const timestamp = new Date(dateString).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

function buildSortedQuoteHistoryRows(
  submittedDate: string | undefined,
  history: QuoteHistoryItem[],
  sortDirection: QuoteHistorySortDirection,
): QuoteHistoryDisplayRow[] {
  const rows: QuoteHistoryDisplayRow[] = [];
  const submittedTimestamp = submittedDate ? new Date(submittedDate).getTime() : Number.NaN;

  if (!Number.isNaN(submittedTimestamp)) {
    rows.push({ kind: 'initial', dateMs: submittedTimestamp });
  }

  for (const item of history) {
    rows.push({ kind: 'item', dateMs: getHistoryItemDateMs(item), item });
  }

  return rows.sort((left, right) =>
    sortDirection === 'desc' ? right.dateMs - left.dateMs : left.dateMs - right.dateMs,
  );
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
      router.push(`/account/approvals/${permission.approvalId}`);
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
    router.push(`/account/approvals/${approval.id}`);
  } catch (error) {
    if (error instanceof ApprovalAlreadyExistsError) {
      setApprovalPermission({
        approvalId: error.approvalId,
        permitted: false,
      });
      closeApprovalInquiryDialog();
      router.push(`/account/approvals/${error.approvalId}`);
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
  globalThis.location.reload();
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
  const hasRelatedApproval = Boolean(approvalPermission?.approvalId);
  let primaryActionLabel = t('accept');
  if (showInquiryCta) {
    primaryActionLabel = hasRelatedApproval ? t('goToApproval') : t('inquireApproval');
  }
  const isPrimaryActionDisabled = quote?.status !== 'OPEN' || isProcessing || isCheckingApprovalPermission;

  return {
    showInquiryCta,
    primaryActionLabel,
    isPrimaryActionDisabled,
  };
}

export function QuoteDetails({ quoteId, initialQuote }: Readonly<QuoteDetailsProps>) {
  const locale = useLocale();
  const t = useTranslations('account.quoteDetails');
  const tQuoteStatus = useTranslations('account.quoteStatus');
  const tApproval = useTranslations('checkout.approval');
  const router = useRouter();
  const { customer } = useCustomer();

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
  const [historySortDirection, setHistorySortDirection] = useState<QuoteHistorySortDirection>('desc');
  const acceptCommentRef = useRef<HTMLTextAreaElement | null>(null);
  const rejectCommentRef = useRef<HTMLTextAreaElement | null>(null);
  const changeCommentRef = useRef<HTMLTextAreaElement | null>(null);

  // Call unconditionally — useApproval no-ops on empty id (Rules of Hooks).
  const relatedApprovalId = approvalPermission?.approvalId ?? '';
  const { approval: relatedApproval } = useApproval(relatedApprovalId);

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

  const sortedApprovers = useMemo(() => sortApproversByLocale(approvers, locale), [approvers, locale]);

  // Use the hook to fetch the quote if not provided as initialQuote
  const { quote: fetchedQuote, loading, error } = useQuote(initialQuote ? undefined : quoteId);

  // Fetch quote history
  const { history: quoteHistory, loading: historyLoading } = useQuoteHistory(quoteId);

  // Use initialQuote if provided, otherwise use fetched quote
  const quote = initialQuote || fetchedQuote;

  const sortedHistoryRows = useMemo(
    () => (quote ? buildSortedQuoteHistoryRows(quote.submittedDate, quoteHistory, historySortDirection) : []),
    [quote, quoteHistory, historySortDirection],
  );

  const toggleHistorySortDirection = () => {
    setHistorySortDirection((current) => (current === 'desc' ? 'asc' : 'desc'));
  };

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

  useEffect(() => {
    if (activeDecisionDialog === 'DECLINE') {
      rejectCommentRef.current?.focus();
      return;
    }

    if (activeDecisionDialog === 'CHANGE') {
      changeCommentRef.current?.focus();
    }
  }, [activeDecisionDialog]);

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

  const { primaryActionLabel, isPrimaryActionDisabled } = getQuotePrimaryActionPresentation({
    quote,
    approvalPermission,
    isProcessing,
    isCheckingApprovalPermission,
    t,
  });

  // Loading / not-found gate (extracted to keep QuoteDetails cognitive complexity ≤ 15)
  if (!isQuoteDetailsReady(loading, error, quote)) {
    return renderQuoteDetailsUnavailableState({
      loading,
      error,
      t,
      onBack: () => router.back(),
    });
  }

  return (
    <div>
      <Dialog open={showApprovalInquiryDialog} onOpenChange={handleApprovalInquiryDialogChange}>
        <DialogContent
          className="sm:max-w-[500px]"
          data-testid="quote-approval-dialog"
          closeTestId="quote-approval-closeButton"
        >
          <DialogHeader>
            <DialogTitle>{tApproval('selectApprover')}</DialogTitle>
            <DialogDescription>{tApproval('selectApproverRequired')}</DialogDescription>
          </DialogHeader>

          {sortedApprovers && sortedApprovers.length > 0 && (
            <ApproverSelectList
              approvers={sortedApprovers}
              selectedUserId={selectedApproverId}
              onSelect={setSelectedApproverId}
              testIdPrefix="quote-approval-approver"
            />
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
              <Button
                variant="secondary"
                size="small"
                onClick={() => void refetchApprovers()}
                data-testid="quote-approval-retryButton"
              >
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
              maxLength={500}
              data-testid="quote-approval-comment"
            />
          </div>

          {processError ? (
            <Alert variant="destructive" role="alert">
              <AlertDescription>{processError}</AlertDescription>
            </Alert>
          ) : null}

          <DialogFooter className="sm:justify-between">
            <Button
              variant="secondary"
              className="w-full sm:w-auto"
              disabled={isProcessing}
              onClick={() => handleApprovalInquiryDialogChange(false)}
              data-testid="quote-approval-cancelButton"
            >
              {tApproval('cancel')}
            </Button>
            <Button
              className="w-full sm:w-auto"
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

      <AccountDetailContainer>
        <AccountDetailHeader
          eyebrow={t('title')}
          title={quote.reference || `#${quoteId}`}
          aside={
            <AccountDetailStatus label={t('status')}>
              <QuoteStatusBadge status={quote.status} emphasized />
            </AccountDetailStatus>
          }
        />

        {showAcceptConfirmation || activeDecisionDialog ? (
          <section
            className={cn(
              'border-b border-border-primary px-6 py-6 sm:px-8',
              activeDecisionDialog === 'CHANGE' && 'border-l-4 border-l-border-action',
            )}
          >
            {showAcceptConfirmation && (
              <>
                <AccountSectionLabel>{t('confirmationTitle')}</AccountSectionLabel>
                <p className="mt-2 text-sm text-text-body">{t('confirmationDescription')}</p>

                <div className="mt-4">
                  <label htmlFor="accept-comment" className="block text-sm font-medium">
                    {t('yourComment')}
                  </label>
                  <Textarea
                    id="accept-comment"
                    ref={acceptCommentRef}
                    placeholder={t('commentPlaceholder')}
                    className="mt-1 h-32 w-full resize-none"
                    value={acceptComment}
                    onChange={(e) => setAcceptComment(e.target.value)}
                    maxLength={maxCommentLength}
                    data-testid="quote-acceptComment"
                  />
                </div>

                <div className="mt-4 text-sm">
                  {t('termsAgreement')}{' '}
                  <UiLink type="Link" variant="text" href="/privacy-policy" data-testid="quote-privacyPolicy">
                    {t('privacyPolicy')}
                  </UiLink>
                  {' and '}
                  <UiLink type="Link" variant="text" href="/terms-and-conditions" data-testid="quote-termsOfUse">
                    {t('termsOfUse')}
                  </UiLink>
                </div>

                {processError ? (
                  <Alert variant="destructive" className="mt-4" role="alert">
                    <AlertDescription>{processError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="mt-4 flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setProcessError(null);
                      setShowAcceptConfirmation(false);
                      setAcceptComment('');
                    }}
                    data-testid="quote-acceptCancelButton"
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
                    data-testid="quote-createOrderButton"
                  >
                    {isProcessing ? t('creating') : t('createOrder')}
                  </Button>
                </div>
              </>
            )}

            {activeDecisionDialog === 'DECLINE' && (
              <div className="flex flex-col gap-4">
                <div>
                  <AccountSectionLabel>{t('rejectConfirmationTitle')}</AccountSectionLabel>
                  <p className="mt-2 text-sm text-text-body">{t('rejectConfirmationDescription')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quote-decision-reason">{t('decisionReasonLabel')}</Label>
                  <Select value={decisionReasonCode} onValueChange={setDecisionReasonCode}>
                    <SelectTrigger
                      id="quote-decision-reason"
                      aria-label={t('decisionReasonLabel')}
                      data-testid="quote-declineReason"
                    >
                      <SelectValue placeholder={t('decisionReasonPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTE_DECISION_REASON_OPTIONS.DECLINE.map((reasonCode) => (
                        <SelectItem
                          key={reasonCode}
                          value={reasonCode}
                          data-testid={`quote-declineReason-${reasonCode}`}
                        >
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
                    ref={rejectCommentRef}
                    placeholder={t('rejectCommentPlaceholder')}
                    className="min-h-32 resize-none"
                    value={decisionComment}
                    onChange={(e) => setDecisionComment(e.target.value)}
                    maxLength={maxCommentLength}
                    data-testid="quote-declineComment"
                  />
                </div>

                {processError ? (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{processError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={isProcessing}
                    onClick={() => handleDecisionDialogChange(null)}
                    data-testid="quote-declineCancelButton"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="red"
                    disabled={!decisionReasonCode || isProcessing}
                    onClick={() => {
                      void handleQuoteDecisionSubmit();
                    }}
                    data-testid="quote-declineConfirmButton"
                  >
                    {isProcessing ? t('rejecting') : t('rejectQuote')}
                  </Button>
                </div>
              </div>
            )}

            {activeDecisionDialog === 'CHANGE' && (
              <div className="flex flex-col gap-4">
                <div>
                  <AccountSectionLabel>{t('requestChangeConfirmationTitle')}</AccountSectionLabel>
                  <p className="mt-2 text-sm text-text-body">{t('requestChangeConfirmationDescription')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quote-change-reason">{t('decisionReasonLabel')}</Label>
                  <Select value={decisionReasonCode} onValueChange={setDecisionReasonCode}>
                    <SelectTrigger
                      id="quote-change-reason"
                      aria-label={t('decisionReasonLabel')}
                      data-testid="quote-changeReason"
                    >
                      <SelectValue placeholder={t('decisionReasonPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {QUOTE_DECISION_REASON_OPTIONS.CHANGE.map((reasonCode) => (
                        <SelectItem
                          key={reasonCode}
                          value={reasonCode}
                          data-testid={`quote-changeReason-${reasonCode}`}
                        >
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
                    ref={changeCommentRef}
                    placeholder={t('requestChangeCommentPlaceholder')}
                    className="min-h-32 resize-none"
                    value={decisionComment}
                    onChange={(event) => setDecisionComment(event.target.value)}
                    maxLength={maxCommentLength}
                    data-testid="quote-changeComment"
                  />
                </div>

                {processError ? (
                  <Alert variant="destructive" role="alert">
                    <AlertDescription>{processError}</AlertDescription>
                  </Alert>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={isProcessing}
                    onClick={() => handleDecisionDialogChange(null)}
                    data-testid="quote-changeCancelButton"
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    disabled={!decisionReasonCode || isProcessing}
                    onClick={() => {
                      void handleQuoteDecisionSubmit();
                    }}
                    data-testid="quote-changeConfirmButton"
                  >
                    {isProcessing ? t('requestingChange') : t('requestChange')}
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : null}

        <div className="border-b border-border-primary">
          <QuoteSummary
            quote={quote}
            relatedApprovalId={approvalPermission?.approvalId}
            relatedApprovalHref={relatedApproval ? getApprovalHref(relatedApproval, customer?.id) : undefined}
          />
        </div>

        <section className="border-b border-border-primary">
          <AccountSectionBar>{t('quotedProducts')}</AccountSectionBar>
          <ProductListResolver
            locale={locale}
            showGrossUnderNet
            presentationConfig={{
              labels: {
                product: t('product'),
                quantity: t('quantity'),
                unitPrice: t('unitPrice'),
                baseNetUnitPrice: t('baseNetUnitPrice'),
                discount: t('discount'),
              },
              showGrossSecondary: true,
              showDiscountColumns: quoteHasItemDiscounts(quote),
            }}
            items={quote.items.map((it) => {
              const qty = it.quantity.quantity;
              const price = it.product.itemPrice;
              return {
                productId: it.product.id,
                quantity: qty,
                unitPrice: resolveQuotedNetUnitPrice(price, qty),
                currency: price.currency,
                grossUnitPrice: resolveQuotedGrossUnitPrice(price, qty),
                netUnitPrice: resolveQuotedNetUnitPrice(price, qty),
                baseNetUnitPrice: price.unitPrice,
                discountPercent: resolveItemDiscountPercent(price),
              };
            })}
          />
        </section>

        <section className="border-b border-border-primary">
          <AccountSectionBar>{t('quoteHistory')}</AccountSectionBar>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead
                  className="py-4 pl-6 pr-4 font-bold sm:pl-8"
                  aria-sort={historySortDirection === 'asc' ? 'ascending' : 'descending'}
                >
                  <button
                    type="button"
                    onClick={toggleHistorySortDirection}
                    className="flex items-center gap-2 hover:text-text-action"
                    data-testid="quote-history-sort-change-date"
                  >
                    {t('changeDate')}
                    {historySortDirection === 'asc' ? (
                      <ArrowUp aria-hidden="true" className="h-4 w-4" />
                    ) : (
                      <ArrowDown aria-hidden="true" className="h-4 w-4" />
                    )}
                  </button>
                </TableHead>
                <TableHead className="px-4 py-4 font-bold">{t('event')}</TableHead>
                <TableHead className="px-4 py-4 font-bold">{t('changedBy')}</TableHead>
                <TableHead className="px-4 py-4 font-bold">{t('status')}</TableHead>
                <TableHead className="py-4 pl-4 pr-6 font-bold sm:pr-8">{t('comment')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {historyLoading ? (
                <>
                  <TableRow data-testid="quote-history-row-initial">
                    <TableCell className="py-4 pl-6 pr-4 sm:pl-8">{formatDate(quote.submittedDate, locale)}</TableCell>
                    <TableCell className="px-4 py-4">{t('initialQuoteRequest')}</TableCell>
                    <TableCell className="px-4 py-4">{quote.customerName || 'Unknown User'}</TableCell>
                    <TableCell className="px-4 py-4">-</TableCell>
                    <TableCell className="py-4 pl-4 pr-6 sm:pr-8">{quote.userComment || '-'}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="px-6 py-4 sm:px-8" colSpan={5}>
                      {t('loadingHistory')}
                    </TableCell>
                  </TableRow>
                </>
              ) : (
                sortedHistoryRows.map((row) => {
                  if (row.kind === 'initial') {
                    return (
                      <TableRow key="quote-history-initial" data-testid="quote-history-row-initial">
                        <TableCell className="py-4 pl-6 pr-4 sm:pl-8">
                          {formatDate(quote.submittedDate, locale)}
                        </TableCell>
                        <TableCell className="px-4 py-4">{t('initialQuoteRequest')}</TableCell>
                        <TableCell className="px-4 py-4">{quote.customerName || 'Unknown User'}</TableCell>
                        <TableCell className="px-4 py-4">-</TableCell>
                        <TableCell className="py-4 pl-4 pr-6 sm:pr-8">{quote.userComment || '-'}</TableCell>
                      </TableRow>
                    );
                  }

                  const { item: historyItem } = row;

                  return (
                    <TableRow key={historyItem.id} data-testid={`quote-history-row-${historyItem.id}`}>
                      <TableCell className="py-4 pl-6 pr-4 sm:pl-8">
                        {formatHistoryDate(historyItem.rawModifiedAt || historyItem.modifiedAt, locale)}
                      </TableCell>
                      <TableCell className="px-4 py-4">{getHistoryAction(historyItem)}</TableCell>
                      <TableCell className="px-4 py-4">{getHistoryUserName(historyItem)}</TableCell>
                      <TableCell className="px-4 py-4">
                        {historyItem.statusValue && isQuoteStatusValue(historyItem.statusValue) ? (
                          <QuoteStatusBadge status={historyItem.statusValue} />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell className="py-4 pl-4 pr-6 sm:pr-8">
                        {getHistoryCommentWithReason(historyItem, t)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </section>

        {!showAcceptConfirmation &&
        !activeDecisionDialog &&
        quote.status !== 'ACCEPTED' &&
        quote.status !== 'DECLINED' ? (
          <footer
            className="border-b border-border-primary px-6 py-6 sm:px-8"
            data-testid="quote-detail-header-actions"
          >
            <AccountSectionLabel className="mb-3">{t('quoteActions')}</AccountSectionLabel>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outlineError"
                size="small"
                className={cn('gap-2 disabled:border-none')}
                disabled={!(quote.status === 'OPEN')}
                onClick={() => {
                  handleDecisionDialogChange('DECLINE');
                }}
                data-testid="quote-rejectButton"
              >
                <CircleX className="h-5 w-5" />
                {t('reject')}
              </Button>

              <Button
                variant="secondary"
                size="small"
                className={cn('gap-2 disabled:border-none')}
                disabled={quote.status !== 'OPEN'}
                onClick={() => {
                  handleDecisionDialogChange('CHANGE');
                }}
                data-testid="quote-requestChangeButton"
              >
                <Pencil className="h-5 w-5" />
                {t('requestChange')}
              </Button>

              <Button
                variant="outlineSuccess"
                size="small"
                className={cn('gap-2 disabled:border-none')}
                disabled={isPrimaryActionDisabled}
                onClick={() => {
                  void handleQuotePrimaryAction();
                }}
                data-testid="quote-primaryButton"
              >
                <CircleCheck className="h-5 w-5" />
                {primaryActionLabel}
              </Button>
            </div>
          </footer>
        ) : null}
      </AccountDetailContainer>
    </div>
  );
}
