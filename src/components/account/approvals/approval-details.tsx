'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { ApprovalSummary } from '@/components/account/approvals/approval-summary';
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
import UiLink from '@/components/ui/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useApproval } from '@/hooks/approval/useApproval';
import useCustomer from '@/hooks/customer/useCustomer';
import { useToast } from '@/hooks/ui/useToast';
import { checkoutApproval as checkoutApi } from '@/lib/client/checkout';
import type { Approval } from '@/platform/services/model/approval';
import type { CheckoutRequest } from '@/platform/services/model/checkout';
import { ApprovalStatusBadge } from './approval-status-badge';

interface ApprovalDetailsProps {
  approvalId: string;
  initialApproval?: Approval;
}

function formatApprovalUserName(user: {
  firstName?: string;
  lastName?: string;
  fullName?: string;
  userId?: string;
}): string {
  if (user.fullName?.trim()) {
    return user.fullName;
  }

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  if (fullName) {
    return fullName;
  }

  return user.userId ?? '-';
}

export function ApprovalDetails({ approvalId, initialApproval }: ApprovalDetailsProps) {
  const locale = useLocale();
  const t = useTranslations('orders.Approval');
  const tAction = useTranslations('orders.ApprovalAction');
  const router = useRouter();
  const { toast } = useToast();
  const { customer, loading: customerLoading } = useCustomer();
  const [comment, setComment] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const {
    approval,
    loading,
    error,
    updateApprovalStatus,
    updateApproverComment,
    updateRequestorComment,
    refreshApproval,
  } = useApproval(approvalId, initialApproval);

  const isRequestor = approval?.requestor.userId === customer?.id;

  const handleApprove = async () => {
    if (isRequestor || approval?.approver.userId !== customer?.id) {
      return;
    }
    try {
      if (isProcessing) return;
      setActionError(null);

      setIsProcessing(true);
      const checkoutResponse = await handleSubmitOrder();
      if (!checkoutResponse) {
        throw new Error('Checkout failed');
      }

      toast({ title: t('success'), description: t('orderSuccessfullySubmitted'), variant: 'success' });
      router.push(`/account/approvals`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDecline = async () => {
    if (isRequestor || approval?.approver.userId !== customer?.id) {
      return;
    }
    try {
      setActionError(null);
      await updateApprovalStatus('DECLINED');
      setActionSuccess(t('approvalSuccessfullyDeclined'));

      if (comment) {
        if (isRequestor) {
          await updateRequestorComment(comment);
        } else {
          await updateApproverComment(comment);
        }
        setComment('');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleComment = async () => {
    try {
      setActionError(null);
      if (isRequestor) {
        await updateRequestorComment(comment);
      } else {
        await updateApproverComment(comment);
      }
      setActionSuccess(t('requestorCommentUpdated'));
      setComment('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleSubmitOrder = async () => {
    if (!approval) return;
    try {
      setActionError(null);

      const cartId = approval.resource.id;
      const details = approval.details;
      const customer = approval.requestor;

      if (!details) {
        throw new Error('Missing approval details for checkout');
      }

      if (!details.addresses || details.addresses.length < 2) {
        throw new Error('Both shipping and billing addresses are required');
      }

      if (!details.shipping) {
        throw new Error('Missing shipping details');
      }

      if (!details.paymentMethods || details.paymentMethods.length === 0) {
        throw new Error('Missing payment method');
      }

      const request: CheckoutRequest = {
        cartId,
        addresses: details.addresses,
        shipping: details.shipping,
        paymentMethod: details.paymentMethods[0],
        customer: {
          userId: customer.userId,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          emailConfirmation: customer.email,
        },
        summary: { termsAndConditions: true },
        currency: details.currency,
      };

      const response = await checkoutApi(request);

      return response;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      throw err;
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

  if (loading || customerLoading) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  }

  if (error || !approval) {
    return (
      <div className="border border-border-primary bg-surface-page p-6">
        <div className="bg-surface-error p-4 text-text-error">
          {t('errorLoadingApproval')}: {error?.message || t('approvalNotFound')}
        </div>
        <Button className="mt-4" onClick={() => refreshApproval()}>
          {t('tryAgain')}
        </Button>
      </div>
    );
  }

  const isDesignatedApprover = approval.approver.userId === customer?.id;
  const canApprove = approval.status === 'PENDING' && isDesignatedApprover && !isRequestor;
  const canComment = approval.status === 'PENDING';

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
        <div className="space-y-4 border-b border-border-primary px-4 py-4 sm:px-6">
          {actionSuccess ? (
            <Alert variant="default">
              <CheckCircle2 className="h-4 w-4" />
              <AlertTitle>{t('success')}</AlertTitle>
              <AlertDescription>{actionSuccess}</AlertDescription>
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

      <div className="border-b border-border-primary">
        <AccountSpecTable>
          <SpecSection title={t('approvalInformation')}>
            <SpecRow
              left={{ label: t('resourceType'), value: approval.resourceType }}
              right={{ label: t('action'), value: tAction(approval.action) }}
            />
            <SpecRow
              left={{
                label: t('resourceId'),
                value:
                  approval.resourceType === 'QUOTE' ? (
                    <UiLink href={`/account/quotes/${approval.resource.id}`} type="Link" variant="primary" size="m">
                      {approval.resource.id}
                    </UiLink>
                  ) : (
                    approval.resource.id
                  ),
              }}
              right={{ label: t('createdAt'), value: formatDate(approval.createdAt) }}
            />
            <SpecRow
              left={{ label: t('requestor'), value: formatApprovalUserName(approval.requestor) }}
              right={{ label: t('approver'), value: formatApprovalUserName(approval.approver) }}
            />
            {approval.updatedAt ? (
              <SpecRow left={{ label: t('updatedAt'), value: formatDate(approval.updatedAt) }} />
            ) : null}
          </SpecSection>
        </AccountSpecTable>
      </div>

      <div className="border-b border-border-primary">
        <ApprovalSummary approval={approval} />
      </div>

      {approval.resource.items && approval.resource.items.length > 0 ? (
        <section className="border-b border-border-primary">
          <AccountSectionBar>{t('orderItems')}</AccountSectionBar>
          <ProductListResolver
            items={approval.resource.items.map((it) => ({
              productId: it.productId,
              itemYrn: it.itemYrn,
              quantity: it.quantity,
              unitPrice: it.itemPrice.amount,
              currency: it.itemPrice.currency,
            }))}
          />
        </section>
      ) : null}

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

      {canComment ? (
        <section className="border-b border-border-primary px-4 py-4 sm:px-6">
          <AccountSectionLabel className="mb-2">{t('addComment')}</AccountSectionLabel>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={t('enterComment')}
            className="mb-2"
          />
          <Button onClick={handleComment} disabled={!comment.trim()}>
            {t('saveComment')}
          </Button>
        </section>
      ) : null}

      {canApprove ? (
        <footer className="border-b border-border-primary px-4 py-4 sm:px-6">
          <AccountSectionLabel className="mb-3">{t('approvalActions')}</AccountSectionLabel>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleApprove}
              disabled={isProcessing}
              className="bg-surface-success hover:bg-surface-action-hover-2"
            >
              {isProcessing ? <Spinner variant="sm" className="mr-2" /> : null}
              {t('approve')}
            </Button>
            <Button onClick={handleDecline} disabled={isProcessing} variant="secondary">
              {t('decline')}
            </Button>
          </div>
        </footer>
      ) : null}

      <footer className="px-4 py-4 sm:px-6">
        <Button variant="neutral" onClick={() => window.history.back()}>
          {t('back')}
        </Button>
      </footer>
    </AccountDetailContainer>
  );
}
