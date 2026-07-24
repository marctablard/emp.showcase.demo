'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2, List, ReceiptText } from 'lucide-react';
import { ApprovalStatusBadge } from '@/components/account/approvals/approval-status-badge';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { H3, H4, H5 } from '@/components/ui/h';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { SummaryCard, SummaryRow } from '@/components/ui/summary-card';
import { Textarea } from '@/components/ui/textarea';
import { useApproval } from '@/hooks/approval/useApproval';
import { useToast } from '@/hooks/ui/useToast';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import type { Approval } from '@/platform/services/model/approval';
import type { QuoteUpdateRequest } from '@/platform/services/model/quote';

const NON_COMMENTABLE_APPROVAL_STATUSES: Approval['status'][] = ['APPROVED', 'DECLINED', 'CLOSED', 'EXPIRED'];
const CREATE_ORDER_ERROR_PREFIX = /^Failed to update quote\b.*?:\s*/i;

interface ApprovalDetailsProps {
  approvalId: string;
  initialApproval?: Approval;
  currentUserId?: string;
}

interface ApprovalResourcePrice {
  currency: string;
  amount?: number;
  netValue?: number;
  grossValue?: number;
  taxValue?: number;
  unitPrice?: number;
  newUnitPrice?: number;
  calculatedPrice?: {
    price?: {
      netValue?: number;
      grossValue?: number;
      taxValue?: number;
    };
  };
}

interface ApprovalResourceItem {
  itemYrn?: string;
  productId?: string;
  quantity: number;
  itemPrice: ApprovalResourcePrice;
}

type ApprovalQuoteResource = Approval['resource'] & {
  items?: ApprovalResourceItem[];
  totalPrice?: ApprovalResourcePrice;
  subTotalPrice?: ApprovalResourcePrice;
  subtotalAggregate?: ApprovalResourcePrice;
};

interface ApprovalCreateOrderResult {
  quoteId: string;
}

function getCreateOrderErrorMessage(message: string): string {
  return message.replace(CREATE_ORDER_ERROR_PREFIX, '').trim();
}

export function ApprovalDetails({ approvalId, initialApproval, currentUserId }: ApprovalDetailsProps) {
  const t = useTranslations('orders.Approval');
  const tQuote = useTranslations('account.quoteDetails');
  const locale = useLocale();
  const { toast } = useToast();
  const maxCommentLength = 250;
  const [approverComment, setApproverComment] = useState<string>('');
  const [requestorComment, setRequestorComment] = useState<string>('');
  const [orderComment, setOrderComment] = useState<string>('');
  const [isCommentFormOpen, setIsCommentFormOpen] = useState(false);
  const [isCreateOrderStepOpen, setIsCreateOrderStepOpen] = useState(false);
  const [createOrderResult, setCreateOrderResult] = useState<ApprovalCreateOrderResult | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isApprovalActionPending, setIsApprovalActionPending] = useState(false);
  const [isOrderCreationPending, setIsOrderCreationPending] = useState(false);
  const orderCommentRef = useRef<HTMLTextAreaElement | null>(null);

  const {
    approval,
    loading,
    error,
    updateApprovalStatus,
    updateApproverComment,
    updateRequestorComment,
    refreshApproval,
  } = useApproval(approvalId, initialApproval);

  useEffect(() => {
    if (!isCreateOrderStepOpen) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      orderCommentRef.current?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [isCreateOrderStepOpen]);

  const updateQuoteStatus = async (quoteId: string, comment?: string, linkedApprovalId?: string): Promise<void> => {
    const operations: QuoteUpdateRequest[] = [
      {
        op: 'REPLACE',
        path: '/status',
        value: {
          value: 'ACCEPTED',
          comment: comment || '',
        },
      },
    ];

    const params = new URLSearchParams({ quoteId, locale });

    if (linkedApprovalId) {
      params.set('approvalId', linkedApprovalId);
    }

    const response = await fetch(`/api/quote/update-status?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(operations),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.error || 'Failed to update quote status to ACCEPTED');
    }
  };

  const handleApprove = async () => {
    setActionError(null);
    setActionSuccess(null);
    setCreateOrderResult(null);
    setIsCreateOrderStepOpen(true);
  };

  const handleDecline = async () => {
    if (isApprovalActionPending) {
      return;
    }

    try {
      setIsApprovalActionPending(true);
      setActionError(null);
      setActionSuccess(null);
      setCreateOrderResult(null);
      setIsCreateOrderStepOpen(false);
      await updateApprovalStatus('DECLINED');
      setActionSuccess(t('approvalSuccessfullyDeclined'));

      if (approverComment) {
        await updateApproverComment(approverComment);
        setApproverComment('');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsApprovalActionPending(false);
    }
  };

  const handleUpdateApproverComment = async () => {
    try {
      setActionError(null);
      setActionSuccess(null);
      setCreateOrderResult(null);
      await updateApproverComment(approverComment);
      setActionSuccess(t('approverCommentUpdated'));
      setApproverComment('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUpdateRequestorComment = async () => {
    try {
      setActionError(null);
      setActionSuccess(null);
      setCreateOrderResult(null);
      await updateRequestorComment(requestorComment);
      setActionSuccess(t('requestorCommentUpdated'));
      setRequestorComment('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleCreateOrder = async (): Promise<void> => {
    if (!quoteResource || isOrderCreationPending) {
      return;
    }

    try {
      setIsOrderCreationPending(true);
      setActionError(null);
      setActionSuccess(null);
      setCreateOrderResult(null);

      await updateQuoteStatus(quoteResource.id, orderComment.trim() || undefined, approvalId);

      setCreateOrderResult({ quoteId: quoteResource.id });
      setActionSuccess(t('quoteSuccessfullyAcceptedOrderAutomaticallyCreated'));
      setOrderComment('');
      setIsCreateOrderStepOpen(false);
      void refreshApproval();
    } catch (err) {
      setCreateOrderResult(null);
      const message = getCreateOrderErrorMessage(err instanceof Error ? err.message : String(err));
      toast({
        title: t('error'),
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsOrderCreationPending(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const formatPrice = (amount?: number, currency?: string) => {
    if (amount === undefined || !currency) {
      return '-';
    }

    return formatCurrency(amount, currency, locale);
  };

  const canApprove = approval?.status === 'PENDING';
  const quoteResource = approval?.resourceType === 'QUOTE' ? (approval.resource as ApprovalQuoteResource) : undefined;
  const quoteItems = quoteResource?.items as ApprovalResourceItem[] | undefined;
  const quoteItemCount = quoteResource?.items?.reduce((total, item) => total + item.quantity, 0) ?? 0;
  const isRequestor = !!approval && currentUserId === approval.requestor.userId;
  const isApprover = !!approval && currentUserId === approval.approver.userId;
  const isApprovalActionLocked = isCreateOrderStepOpen || isApprovalActionPending || isOrderCreationPending;
  const canComment =
    !!approval && !NON_COMMENTABLE_APPROVAL_STATUSES.includes(approval.status) && (isRequestor || isApprover);
  const canApprovalAction = canApprove && isApprover;
  const canCreateOrder =
    approval?.status === 'PENDING' && approval?.resourceType === 'QUOTE' && isApprover && isCreateOrderStepOpen;
  const shouldShowActionError = !!actionError && !isCreateOrderStepOpen;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalDetails')}</CardTitle>
          <CardDescription>{t('approvalDetailsDescription')}</CardDescription>
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

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalDetails')}</CardTitle>
          <CardDescription>{t('approvalDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-surface-error p-4 rounded-md text-text-error">
            {t('errorLoadingApproval')}: {error.message}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => refreshApproval()}>{t('tryAgain')}</Button>
        </CardFooter>
      </Card>
    );
  }

  if (!approval) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalDetails')}</CardTitle>
          <CardDescription>{t('approvalDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-text-placeholders">{t('approvalNotFound')}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="flex items-center gap-6">
          <H3>
            {t('approval')}: {approval.id}
          </H3>
          <ApprovalStatusBadge status={approval.status} />
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {canApprovalAction && (
            <>
              <Button variant="outlineError" size="small" onClick={handleDecline} disabled={isApprovalActionLocked}>
                {t('decline')}
              </Button>
              <Button variant="outlineSuccess" size="small" onClick={handleApprove} disabled={isApprovalActionLocked}>
                {t('approve')}
              </Button>
            </>
          )}
          {canComment && (
            <Button variant="secondary" size="small" onClick={() => setIsCommentFormOpen((isOpen) => !isOpen)}>
              {t('addComment')}
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-md bg-surface-primary p-6 shadow-sm">
        <H4 className="mb-6">{t('approvalDetails')}</H4>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            {quoteResource ? (
              <>
                <div className="flex flex-col gap-1">
                  <H5>{tQuote('quotationDate')}</H5>
                  <span className="text-base font-body text-text-body">{formatDate(approval.createdAt)}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <H5>{tQuote('totalAmount')}</H5>
                  <span className="text-base font-body text-text-body">
                    {formatPrice(
                      quoteResource.totalPrice?.grossValue ?? quoteResource.totalPrice?.amount,
                      quoteResource.totalPrice?.currency,
                    )}
                  </span>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-1">
                  <H5>{t('resourceType')}</H5>
                  <span className="text-base font-body text-text-body">{approval.resourceType}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <H5>{t('resourceId')}</H5>
                  <span className="text-base font-body text-text-body">{approval.resource.id}</span>
                </div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <H5>{tQuote('requestedBy')}</H5>
              <span className="text-base font-body text-text-body">
                {approval.requestor.firstName} {approval.requestor.lastName}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <H5>{tQuote('relatedOrder')}</H5>
              {approval.resource.orderId ? (
                <Link
                  href={`/account/orders/${approval.resource.orderId}`}
                  className="text-base font-body text-text-action"
                >
                  {approval.resource.orderId}
                </Link>
              ) : (
                <span className="text-base font-body text-text-body">-</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {canCreateOrder && quoteResource && (
        <div className="rounded-md bg-surface-primary p-6 shadow-sm">
          <div className="flex flex-col gap-6">
            <div>
              <H4>{t('acceptQuoteAfterApprovalTitle')}</H4>
              <p className="mt-2 text-base font-body text-text-body">{t('acceptQuoteAfterApprovalDescription')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="approval-order-comment">{tQuote('yourComment')}</Label>
              <Textarea
                ref={orderCommentRef}
                id="approval-order-comment"
                placeholder={tQuote('commentPlaceholder')}
                className="min-h-32 resize-none"
                value={orderComment}
                onChange={(event) => setOrderComment(event.target.value.slice(0, maxCommentLength))}
                maxLength={maxCommentLength}
                disabled={isOrderCreationPending}
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="secondary"
                disabled={isOrderCreationPending}
                onClick={() => {
                  setOrderComment('');
                  setIsCreateOrderStepOpen(false);
                }}
              >
                {tQuote('cancel')}
              </Button>
              <Button
                disabled={isOrderCreationPending}
                onClick={() => {
                  void handleCreateOrder();
                }}
              >
                {isOrderCreationPending ? t('acceptingQuoteAfterApprovalAction') : t('acceptQuoteAfterApprovalAction')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {canComment && isCommentFormOpen && (
        <div className="rounded-md bg-surface-primary p-6 shadow-sm">
          <div className="flex flex-col gap-6">
            {isApprover && (
              <>
                <H4>{t('addApproverComment')}</H4>
                <div className="space-y-2">
                  <Label htmlFor="approval-approver-comment">{t('comment')}</Label>
                  <Textarea
                    id="approval-approver-comment"
                    value={approverComment}
                    onChange={(event) => setApproverComment(event.target.value.slice(0, maxCommentLength))}
                    placeholder={t('enterApproverComment')}
                    className="min-h-32 resize-none"
                    maxLength={maxCommentLength}
                    disabled={isApprovalActionLocked}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    disabled={isApprovalActionLocked}
                    onClick={() => setIsCommentFormOpen(false)}
                  >
                    {tQuote('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdateApproverComment}
                    disabled={!approverComment.trim() || isApprovalActionLocked}
                  >
                    {t('saveApproverComment')}
                  </Button>
                </div>
              </>
            )}

            {isRequestor && (
              <>
                <H4>{t('addRequestorComment')}</H4>
                <div className="space-y-2">
                  <Label htmlFor="approval-requestor-comment">{t('comment')}</Label>
                  <Textarea
                    id="approval-requestor-comment"
                    value={requestorComment}
                    onChange={(event) => setRequestorComment(event.target.value.slice(0, maxCommentLength))}
                    placeholder={t('enterRequestorComment')}
                    className="min-h-32 resize-none"
                    maxLength={maxCommentLength}
                    disabled={isApprovalActionLocked}
                  />
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button
                    variant="secondary"
                    disabled={isApprovalActionLocked}
                    onClick={() => setIsCommentFormOpen(false)}
                  >
                    {tQuote('cancel')}
                  </Button>
                  <Button
                    onClick={handleUpdateRequestorComment}
                    disabled={!requestorComment.trim() || isApprovalActionLocked}
                  >
                    {t('saveRequestorComment')}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="rounded-md bg-surface-primary p-4 shadow-sm">
        <H4 className="mb-4">{t('approvalHistory')}</H4>
        <div className="hidden grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)_minmax(160px,1fr)_120px_minmax(160px,1fr)] gap-6 border-b border-border-primary pb-4 sm:grid">
          <span className="text-sm font-bold text-text-headings">{t('date')}</span>
          <span className="text-sm font-bold text-text-headings">{t('event')}</span>
          <span className="text-sm font-bold text-text-headings">{t('changedBy')}</span>
          <span className="text-sm font-bold text-text-headings">{t('status')}</span>
          <span className="text-sm font-bold text-text-headings">{t('comment')}</span>
        </div>
        <div className="grid grid-cols-1 gap-3 py-4 text-base font-body text-text-body sm:grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)_minmax(160px,1fr)_120px_minmax(160px,1fr)] sm:gap-6">
          <span>{formatDate(approval.createdAt)}</span>
          <span>{t('approvalRequestCreated')}</span>
          <span>
            {approval.requestor.firstName} {approval.requestor.lastName}
          </span>
          <ApprovalStatusBadge status={approval.status} className="w-fit" />
          <span>{approval.comment || '-'}</span>
        </div>
      </div>

      <div className="space-y-6">
        {actionSuccess && (
          <Alert variant="default" className="mb-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t('success')}</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                <p>{actionSuccess}</p>
                {createOrderResult && (
                  <div className="flex flex-wrap gap-4 text-sm">
                    <Link href={`/account/quotes/${createOrderResult.quoteId}`} className="font-bold underline">
                      {t('viewRelatedQuote')}
                    </Link>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {shouldShowActionError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('error')}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {quoteResource && (
          <div>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
                  <SummaryCard
                    heading={tQuote('details')}
                    className="h-full gap-2 rounded-md py-4 shadow-none"
                    icon={<ReceiptText className="h-8 w-8 text-text-action" />}
                    hasHeadline
                  >
                    <div className="space-y-3">
                      <div>
                        <div className="text-lg font-bold">{tQuote('quoteReference')}</div>
                        <Link href={`/account/quotes/${quoteResource.id}`} className="text-base text-text-action">
                          {quoteResource.id}
                        </Link>
                      </div>

                      <div>
                        <div className="text-lg font-bold">{tQuote('numberOfProducts')}</div>
                        <div className="text-base">{quoteItemCount}</div>
                      </div>

                      {quoteResource.siteCode && (
                        <div>
                          <div className="text-lg font-bold">{t('siteCode')}</div>
                          <div className="text-base">{quoteResource.siteCode}</div>
                        </div>
                      )}
                    </div>
                  </SummaryCard>
                </div>

                <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
                  <SummaryCard
                    heading={tQuote('basePrice')}
                    className="h-full gap-2 rounded-md py-4 shadow-none"
                    icon={<List className="h-8 w-8 text-text-action" />}
                    hasHeadline
                  >
                    <div className="space-y-3">
                      <SummaryRow label={tQuote('netValue')} className="text-base">
                        {formatPrice(
                          quoteResource.subtotalAggregate?.netValue,
                          quoteResource.subtotalAggregate?.currency,
                        )}
                      </SummaryRow>
                      <SummaryRow label={tQuote('vat')} className="text-base">
                        {formatPrice(
                          quoteResource.subtotalAggregate?.taxValue,
                          quoteResource.subtotalAggregate?.currency,
                        )}
                      </SummaryRow>
                      <SummaryRow label={tQuote('baseTotal')} strong className="text-base">
                        {formatPrice(
                          quoteResource.subtotalAggregate?.grossValue ?? quoteResource.subTotalPrice?.grossValue,
                          quoteResource.subtotalAggregate?.currency ?? quoteResource.subTotalPrice?.currency,
                        )}
                      </SummaryRow>
                    </div>
                  </SummaryCard>
                </div>

                <div className="rounded-md bg-surface-action-hover-2 p-6 shadow-sm">
                  <SummaryCard
                    heading={tQuote('quotedPrice')}
                    className="h-full gap-2 rounded-md py-4 shadow-none"
                    icon={<ReceiptText className="h-8 w-8 text-text-action" />}
                    hasHeadline
                  >
                    <div className="space-y-3">
                      <SummaryRow label={tQuote('netValue')} className="text-base">
                        {formatPrice(quoteResource.totalPrice?.netValue, quoteResource.totalPrice?.currency)}
                      </SummaryRow>
                      <SummaryRow label={tQuote('vat')} className="text-base">
                        {formatPrice(quoteResource.totalPrice?.taxValue, quoteResource.totalPrice?.currency)}
                      </SummaryRow>
                      <SummaryRow label={tQuote('quotedTotal')} strong className="text-base">
                        {formatPrice(quoteResource.totalPrice?.grossValue, quoteResource.totalPrice?.currency)}
                      </SummaryRow>
                    </div>
                  </SummaryCard>
                </div>
              </div>

              {quoteItems && quoteItems.length > 0 && (
                <ProductListResolver
                  items={quoteItems.map((item) => ({
                    productId: item.productId,
                    itemYrn: item.itemYrn,
                    quantity: item.quantity,
                    unitPrice: item.itemPrice.newUnitPrice ?? item.itemPrice.unitPrice ?? item.itemPrice.amount ?? 0,
                    currency: item.itemPrice.currency,
                  }))}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
