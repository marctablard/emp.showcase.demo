'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { ApprovalStatusBadge } from '@/components/account/approvals/approval-status-badge';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
  AccountSectionLabel,
} from '@/components/account/shared/account-detail';
import {
  AccountSpecTable,
  SpecFullWidthRow,
  SpecRow,
  SpecSection,
} from '@/components/account/shared/account-spec-table';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useApproval } from '@/hooks/approval/useApproval';
import { Link } from '@/i18n/navigation';
import { formatCurrency } from '@/lib/utils';
import type { Approval } from '@/platform/services/model/approval';
import type { QuoteUpdateRequest } from '@/platform/services/model/quote';

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

export function ApprovalDetails({ approvalId, initialApproval, currentUserId }: ApprovalDetailsProps) {
  const t = useTranslations('orders.Approval');
  const tQuote = useTranslations('account.quoteDetails');
  const locale = useLocale();
  const maxCommentLength = 250;
  const [approverComment, setApproverComment] = useState<string>('');
  const [requestorComment, setRequestorComment] = useState<string>('');
  const [orderComment, setOrderComment] = useState<string>('');
  const [isCreateOrderStepOpen, setIsCreateOrderStepOpen] = useState(false);
  const [createOrderResult, setCreateOrderResult] = useState<ApprovalCreateOrderResult | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isApprovalActionPending, setIsApprovalActionPending] = useState(false);
  const [isOrderCreationPending, setIsOrderCreationPending] = useState(false);

  const {
    approval,
    loading,
    error,
    updateApprovalStatus,
    updateApproverComment,
    updateRequestorComment,
    refreshApproval,
  } = useApproval(approvalId, initialApproval);

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
      setActionError(err instanceof Error ? err.message : String(err));
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
  const canComment = approval?.status !== 'CLOSED' && approval?.status !== 'EXPIRED' && (isRequestor || isApprover);
  const canApprovalAction = canApprove && isApprover;
  const canCreateOrder =
    approval?.status === 'PENDING' && approval?.resourceType === 'QUOTE' && isApprover && isCreateOrderStepOpen;

  if (loading) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <div className="bg-surface-error p-4 text-text-error">
          {t('errorLoadingApproval')}: {error.message}
        </div>
        <Button className="mt-4" onClick={() => refreshApproval()}>
          {t('tryAgain')}
        </Button>
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="border border-border-primary bg-surface-page p-6 text-center">
        <p className="text-text-placeholders">{t('approvalNotFound')}</p>
      </div>
    );
  }

  return (
    <AccountDetailContainer>
      <AccountDetailHeader
        eyebrow={t('approvalDetails')}
        title={`#${approval.id}`}
        aside={
          <AccountDetailStatus label={t('status')}>
            <ApprovalStatusBadge status={approval.status} emphasized />
          </AccountDetailStatus>
        }
      />

      {(actionSuccess || actionError) && (
        <div className="space-y-4 border-b border-border-primary px-6 py-6 sm:px-8">
          {actionSuccess ? (
            <Alert variant="default">
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
          ) : null}

          {actionError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>{t('error')}</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          ) : null}
        </div>
      )}

      {canCreateOrder && quoteResource && (
        <section className="border-b border-border-primary px-6 py-6 sm:px-8">
          <AccountSectionLabel className="mb-1">{t('createOrderAfterApprovalTitle')}</AccountSectionLabel>
          <p className="mb-4 text-sm text-text-placeholders">{t('createOrderAfterApprovalDescription')}</p>

          <div className="mb-4">
            <label htmlFor="approval-order-comment" className="mb-1 block text-sm font-medium">
              {tQuote('yourComment')}
            </label>
            <Textarea
              id="approval-order-comment"
              placeholder={tQuote('commentPlaceholder')}
              className="h-32 w-full resize-none"
              value={orderComment}
              onChange={(event) => setOrderComment(event.target.value.slice(0, maxCommentLength))}
              maxLength={maxCommentLength}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="small"
              disabled={isOrderCreationPending}
              onClick={() => {
                setOrderComment('');
                setIsCreateOrderStepOpen(false);
              }}
            >
              {tQuote('cancel')}
            </Button>
            <Button
              size="small"
              disabled={isOrderCreationPending}
              onClick={() => {
                void handleCreateOrder();
              }}
            >
              {isOrderCreationPending ? tQuote('creating') : tQuote('createOrder')}
            </Button>
          </div>
        </section>
      )}

      <div className="border-b border-border-primary">
        <AccountSpecTable>
          <SpecSection title={t('approvalInformation')}>
            <SpecRow
              left={{ label: t('resourceType'), value: approval.resourceType }}
              right={{ label: t('action'), value: approval.action }}
            />
            <SpecRow
              left={{
                label: t('resourceId'),
                value:
                  approval.resourceType === 'QUOTE' ? (
                    <Link href={`/account/quotes/${approval.resource.id}`} className="text-text-action underline">
                      {approval.resource.id}
                    </Link>
                  ) : (
                    approval.resource.id
                  ),
              }}
              right={{ label: t('createdAt'), value: formatDate(approval.createdAt) }}
            />
            <SpecRow
              left={{ label: t('requestorId'), value: approval.requestor.userId }}
              right={{ label: t('approverId'), value: approval.approver.userId }}
            />
            {approval.updatedAt ? (
              <SpecRow left={{ label: t('updatedAt'), value: formatDate(approval.updatedAt) }} />
            ) : null}
          </SpecSection>
        </AccountSpecTable>
      </div>

      <div className="border-b border-border-primary">
        <AccountSpecTable>
          <SpecFullWidthRow label={t('requestorComment')}>
            {approval.comment ? (
              <span>{approval.comment}</span>
            ) : (
              <span className="text-text-placeholders">{t('noRequestorComment')}</span>
            )}
          </SpecFullWidthRow>
          <SpecFullWidthRow label={t('approverComment')}>
            {approval.approverComment ? (
              <span>{approval.approverComment}</span>
            ) : (
              <span className="text-text-placeholders">{t('noApproverComment')}</span>
            )}
          </SpecFullWidthRow>
        </AccountSpecTable>
      </div>

      {quoteResource && (
        <>
          <div className="border-b border-border-primary">
            <AccountSpecTable>
              <SpecSection title={tQuote('details')}>
                <SpecRow
                  left={{ label: tQuote('quoteReference'), value: quoteResource.id }}
                  right={{ label: tQuote('numberOfProducts'), value: quoteItemCount }}
                />
                {quoteResource.siteCode ? (
                  <SpecRow left={{ label: t('siteCode'), value: quoteResource.siteCode }} />
                ) : null}
              </SpecSection>
            </AccountSpecTable>
          </div>

          <section className="border-b border-border-primary">
            <AccountSectionBar>{tQuote('quotedProducts')}</AccountSectionBar>

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

            <div className="border-t border-border-primary px-6 py-6 sm:px-8">
              <table className="ml-auto w-full max-w-sm border-collapse text-sm">
                <tbody>
                  <tr>
                    <td className="py-1 pr-8 text-text-body">{tQuote('basePrice')}</td>
                    <td className="py-1 text-right font-medium tabular-nums">
                      {formatPrice(
                        quoteResource.subtotalAggregate?.grossValue ?? quoteResource.subTotalPrice?.grossValue,
                        quoteResource.subtotalAggregate?.currency ?? quoteResource.subTotalPrice?.currency,
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 pr-8 text-text-body">{tQuote('vat')}</td>
                    <td className="py-1 text-right font-medium tabular-nums">
                      {formatPrice(quoteResource.totalPrice?.taxValue, quoteResource.totalPrice?.currency)}
                    </td>
                  </tr>
                  <tr className="border-t border-border-primary">
                    <td className="pt-3 pr-8 font-bold text-text-headings">{tQuote('quotedTotal')}</td>
                    <td className="pt-3 text-right font-bold tabular-nums text-text-headings">
                      {formatPrice(quoteResource.totalPrice?.grossValue, quoteResource.totalPrice?.currency)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {canApprovalAction && (
        <footer className="border-b border-border-primary px-6 py-6 sm:px-8">
          <AccountSectionLabel className="mb-3">{t('approvalActions')}</AccountSectionLabel>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outlineSuccess"
              size="small"
              onClick={handleApprove}
              className="hover:bg-surface-action-hover-2"
              disabled={isApprovalActionPending}
            >
              {t('approve')}
            </Button>
            <Button onClick={handleDecline} variant="secondary" size="small" disabled={isApprovalActionPending}>
              {t('decline')}
            </Button>
          </div>
        </footer>
      )}

      {canComment && (
        <section className="border-b border-border-primary px-6 py-6 sm:px-8">
          {isApprover && (
            <div>
              <AccountSectionLabel className="mb-2">{t('addApproverComment')}</AccountSectionLabel>
              <Textarea
                value={approverComment}
                onChange={(e) => setApproverComment(e.target.value.slice(0, maxCommentLength))}
                placeholder={t('enterApproverComment')}
                className="mb-2"
                maxLength={maxCommentLength}
              />
              <Button size="small" onClick={handleUpdateApproverComment} disabled={!approverComment.trim()}>
                {t('saveApproverComment')}
              </Button>
            </div>
          )}

          {isRequestor && (
            <div className={isApprover ? 'mt-6' : undefined}>
              <AccountSectionLabel className="mb-2">{t('addRequestorComment')}</AccountSectionLabel>
              <Textarea
                value={requestorComment}
                onChange={(e) => setRequestorComment(e.target.value.slice(0, maxCommentLength))}
                placeholder={t('enterRequestorComment')}
                className="mb-2"
                maxLength={maxCommentLength}
              />
              <Button size="small" onClick={handleUpdateRequestorComment} disabled={!requestorComment.trim()}>
                {t('saveRequestorComment')}
              </Button>
            </div>
          )}
        </section>
      )}

      <footer className="px-6 py-6 sm:px-8">
        <Button variant="neutral" onClick={() => window.history.back()}>
          {t('back')}
        </Button>
      </footer>
    </AccountDetailContainer>
  );
}
