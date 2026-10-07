'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CircleAlert, CircleCheck, CircleX, MessageSquareText } from 'lucide-react';
import { resolveApprovalTotalNetAmount } from '@/components/account/approvals/approval-net-amount';
import { ApprovalSummary } from '@/components/account/approvals/approval-summary';
import {
  AccountDetailContainer,
  AccountDetailHeader,
  AccountDetailStatus,
  AccountSectionBar,
  AccountSectionLabel,
} from '@/components/account/shared/account-detail';
import { AccountSpecTable, SpecRow, SpecSection } from '@/components/account/shared/account-spec-table';
import { resolveItemDiscountPercent } from '@/components/account/shared/item-discount';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import UiLink from '@/components/ui/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useApproval } from '@/hooks/approval/useApproval';
import useCustomer from '@/hooks/customer/useCustomer';
import { useOrder } from '@/hooks/order/useOrder';
import { useToast } from '@/hooks/ui/useToast';
import { checkoutApproval as checkoutApi } from '@/lib/client/checkout';
import { formatCurrency } from '@/lib/utils';
import type { Approval } from '@/platform/services/model/approval';
import type { CheckoutRequest } from '@/platform/services/model/checkout';
import { ApprovalStatusBadge } from './approval-status-badge';

interface ApprovalDetailsProps {
  readonly approvalId: string;
  readonly initialApproval?: Approval;
}

function formatApprovalNetAmount(approval: Approval, locale: string): string {
  const net = resolveApprovalTotalNetAmount(approval);
  if (!net) return '-';
  return formatCurrency(net.amount, net.currency, locale);
}

/** CART approval order id after checkout — prefer Approval Service `createdResource.id`. */
export function resolveCartApprovalOrderId(approval: Approval): string | undefined {
  if (approval.resourceType !== 'CART') {
    return undefined;
  }
  const createdId = approval.createdResource?.id?.trim();
  if (createdId) {
    return createdId;
  }
  const resourceOrderId = approval.resource.orderId?.trim();
  return resourceOrderId || undefined;
}

function CartApprovalOrderLink({ orderId }: { readonly orderId: string }) {
  const { order } = useOrder({ orderId, autoFetchStatusTransitions: false });

  if (!order) {
    return <span>{orderId}</span>;
  }

  return (
    <UiLink
      href={`/account/orders/${orderId}`}
      type="Link"
      variant="primary"
      size="m"
      data-testid="approval-relatedOrder"
    >
      {orderId}
    </UiLink>
  );
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
  const tResourceType = useTranslations('orders.ApprovalResourceType');
  const router = useRouter();
  const { toast } = useToast();
  const { customer, loading: customerLoading } = useCustomer();
  const [comment, setComment] = useState<string>('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCommentFormOpen, setIsCommentFormOpen] = useState(false);
  const [isDeclineDialogOpen, setIsDeclineDialogOpen] = useState(false);
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isCommentFormOpen) {
      commentTextareaRef.current?.focus();
    }
  }, [isCommentFormOpen]);

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
  const isDesignatedApprover = approval?.approver.userId === customer?.id;

  const handleApproveClick = () => {
    if (isRequestor || approval?.approver.userId !== customer?.id) {
      return;
    }
    setActionError(null);
    setIsApproveDialogOpen(true);
  };

  const handleApproveDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsApproveDialogOpen(true);
      return;
    }
    if (isProcessing) return;
    setIsApproveDialogOpen(false);
  };

  const handleCancelApprove = () => {
    if (isProcessing) return;
    setIsApproveDialogOpen(false);
  };

  const handleConfirmApprove = async () => {
    if (isRequestor || approval?.approver.userId !== customer?.id || isProcessing || !approval) {
      return;
    }
    try {
      setActionError(null);
      setIsProcessing(true);

      // QUOTE: status update only — never run cart checkout (finding 24c).
      if (approval.resourceType === 'QUOTE') {
        await updateApprovalStatus('APPROVED');

        if (comment) {
          await updateApproverComment(comment);
          setComment('');
        }

        setIsApproveDialogOpen(false);
        notify({
          title: t('success'),
          description: t('approvalSuccessfullyApproved'),
          type: ToastType.Success,
        });
        return;
      }

      // CART (and ORDER-like) keep checkout-after-approve behind the confirm dialog.
      const checkoutResponse = await handleSubmitOrder();
      if (!checkoutResponse) {
        throw new Error('Checkout failed');
      }

      setIsApproveDialogOpen(false);
      toast({ title: t('success'), description: t('orderSuccessfullySubmitted'), variant: 'success' });
      router.push(`/account/approvals`);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setIsApproveDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeclineClick = () => {
    if (isRequestor || approval?.approver.userId !== customer?.id) {
      return;
    }
    setActionError(null);
    setIsDeclineDialogOpen(true);
  };

  const handleDeclineDialogOpenChange = (open: boolean) => {
    if (open) {
      setIsDeclineDialogOpen(true);
      return;
    }
    // Ignore dismiss attempts (Escape/outside click/close button) while the decline mutation is pending.
    if (isProcessing) return;
    setIsDeclineDialogOpen(false);
  };

  const handleCancelDecline = () => {
    if (isProcessing) return;
    setIsDeclineDialogOpen(false);
  };

  const handleConfirmDecline = async () => {
    if (isRequestor || approval?.approver.userId !== customer?.id || isProcessing) {
      return;
    }
    try {
      setActionError(null);
      setIsProcessing(true);
      await updateApprovalStatus('DECLINED');

      if (comment) {
        if (isRequestor) {
          await updateRequestorComment(comment);
        } else {
          await updateApproverComment(comment);
        }
        setComment('');
      }

      setIsDeclineDialogOpen(false);
      notify({ title: t('success'), description: t('approvalSuccessfullyDeclined'), type: ToastType.Success });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
      setIsDeclineDialogOpen(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleComment = async () => {
    if (!isRequestor && !isDesignatedApprover) {
      return;
    }
    try {
      setActionError(null);
      if (isRequestor) {
        await updateRequestorComment(comment);
      } else {
        await updateApproverComment(comment);
      }
      setComment('');
      setIsCommentFormOpen(false);
      notify({
        title: t('success'),
        description: isRequestor ? t('requestorCommentUpdated') : t('approverCommentUpdated'),
        type: ToastType.Success,
      });
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

  // A customer-only load must not replace SSR-backed approval content that is already
  // available (initialApproval). The hook's own `loading` (missing approval, refetch,
  // or mutation in flight) still gates the full loading state.
  const showLoadingState = loading || (customerLoading && !approval);

  let content: React.ReactNode;

  if (showLoadingState) {
    content = (
      <div className="border border-border-primary bg-surface-page p-6">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="mt-4 h-5 w-40" />
        <Skeleton className="mt-6 h-40 w-full" />
      </div>
    );
  } else if (error || !approval) {
    content = (
      <div className="border border-border-primary bg-surface-page p-6">
        <div className="bg-surface-error p-4 text-text-error">
          {t('errorLoadingApproval')}: {error?.message || t('approvalNotFound')}
        </div>
        <Button className="mt-4" onClick={() => refreshApproval()} data-testid="approval-retryButton">
          {t('tryAgain')}
        </Button>
      </div>
    );
  } else {
    const canApprove = approval.status === 'PENDING' && isDesignatedApprover && !isRequestor;
    const canComment = approval.status === 'PENDING' && (isRequestor || isDesignatedApprover);
    const cartOrderId = resolveCartApprovalOrderId(approval);
    const historyCellFirst = 'py-4 pl-6 pr-4 sm:pl-8';
    const historyCell = 'px-4 py-4';
    const historyCellLast = 'py-4 pl-4 pr-6 sm:pr-8';

    let relatedResource: { label: string; value: React.ReactNode } | undefined;
    if (approval.resourceType === 'QUOTE') {
      relatedResource = {
        label: t('relatedQuote'),
        value: (
          <UiLink
            href={`/account/quotes/${approval.resource.id}`}
            type="Link"
            variant="primary"
            size="m"
            data-testid="approval-relatedQuote"
          >
            {approval.resource.id}
          </UiLink>
        ),
      };
    } else if (cartOrderId) {
      relatedResource = { label: t('orderNumber'), value: <CartApprovalOrderLink orderId={cartOrderId} /> };
    }

    content = (
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

        {actionError ? (
          <div className="border-b border-border-primary px-6 py-6 sm:px-8">
            <Alert variant="destructive">
              <CircleAlert className="h-4 w-4" />
              <AlertTitle>{t('error')}</AlertTitle>
              <AlertDescription>{actionError}</AlertDescription>
            </Alert>
          </div>
        ) : null}

        <div className="border-b border-border-primary">
          <AccountSpecTable>
            <SpecSection title={t('approvalInformation')}>
              <SpecRow
                left={{ label: t('resourceType'), value: tResourceType(approval.resourceType) }}
                right={{ label: t('action'), value: tAction(approval.action) }}
              />
              <SpecRow
                left={{ label: t('createdAt'), value: formatDate(approval.createdAt) }}
                right={{ label: t('totalNetAmount'), value: formatApprovalNetAmount(approval, locale) }}
              />
              <SpecRow
                left={{ label: t('requestedBy'), value: formatApprovalUserName(approval.requestor) }}
                right={{ label: t('approver'), value: formatApprovalUserName(approval.approver) }}
              />
              {relatedResource || approval.updatedAt ? (
                <SpecRow
                  left={relatedResource ?? { label: t('updatedAt'), value: formatDate(approval.updatedAt) }}
                  right={
                    relatedResource && approval.updatedAt
                      ? { label: t('updatedAt'), value: formatDate(approval.updatedAt) }
                      : undefined
                  }
                />
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
                showDiscountColumns: approval.resource.items.some((it) => {
                  const percent = resolveItemDiscountPercent(it.itemPrice);
                  return typeof percent === 'number' && percent > 0;
                }),
              }}
              items={approval.resource.items.map((it) => {
                let quotedNet = it.itemPrice.amount;
                if (typeof it.itemPrice.newUnitPrice === 'number') {
                  quotedNet = it.itemPrice.newUnitPrice;
                } else if (typeof it.itemPrice.netValue === 'number') {
                  quotedNet = it.itemPrice.netValue;
                }
                return {
                  productId: it.productId,
                  itemYrn: it.itemYrn,
                  quantity: it.quantity,
                  unitPrice: quotedNet,
                  currency: it.itemPrice.currency,
                  grossUnitPrice: it.itemPrice.grossValue,
                  netUnitPrice: quotedNet,
                  baseNetUnitPrice: it.itemPrice.unitPrice,
                  discountPercent: resolveItemDiscountPercent(it.itemPrice),
                };
              })}
            />
          </section>
        ) : null}

        <section className="border-b border-border-primary" data-testid="approval-history">
          <AccountSectionBar>{t('approvalHistory')}</AccountSectionBar>
          <div data-testid="approval-history-table-scroll">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={`${historyCellFirst} font-bold`}>{t('date')}</TableHead>
                  <TableHead className={`${historyCell} font-bold`}>{t('event')}</TableHead>
                  <TableHead className={`${historyCell} font-bold`}>{t('changedBy')}</TableHead>
                  <TableHead className={`${historyCell} font-bold`}>{t('comment')}</TableHead>
                  <TableHead className={`${historyCellLast} font-bold`}>{t('changeReason')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {approval.approverComment ? (
                  <TableRow data-testid="approval-history-approver-comment">
                    <TableCell className={historyCellFirst}>-</TableCell>
                    <TableCell className={historyCell}>{t('approverComment')}</TableCell>
                    <TableCell className={historyCell}>
                      {formatApprovalUserName(approval.approver)} ({t('roleApprover')})
                    </TableCell>
                    <TableCell className={historyCell}>{approval.approverComment}</TableCell>
                    <TableCell className={historyCellLast}>-</TableCell>
                  </TableRow>
                ) : null}
                <TableRow data-testid="approval-history-request">
                  <TableCell className={historyCellFirst}>{formatDate(approval.createdAt)}</TableCell>
                  <TableCell className={historyCell}>{t('approvalRequestCreated')}</TableCell>
                  <TableCell className={historyCell}>
                    {formatApprovalUserName(approval.requestor)} ({t('roleCustomer')})
                  </TableCell>
                  <TableCell className={historyCell}>{approval.comment || '-'}</TableCell>
                  <TableCell className={historyCellLast}>-</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>

        {canComment && isCommentFormOpen ? (
          <section className="border-b border-border-primary px-6 py-6 sm:px-8">
            <AccountSectionLabel className="mb-2">{t('addComment')}</AccountSectionLabel>
            <Textarea
              ref={commentTextareaRef}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={t('enterComment')}
              className="mb-2"
              data-testid="approval-commentInput"
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => setIsCommentFormOpen(false)}
                data-testid="approval-commentCancelButton"
              >
                {t('back')}
              </Button>
              <Button onClick={handleComment} disabled={!comment.trim()} data-testid="approval-commentSaveButton">
                {t('saveComment')}
              </Button>
            </div>
          </section>
        ) : null}

        {canApprove || canComment ? (
          <footer className="border-b border-border-primary px-6 py-6 sm:px-8" data-testid="approval-detail-actions">
            <AccountSectionLabel className="mb-3">{t('approvalActions')}</AccountSectionLabel>
            <div className="flex flex-wrap gap-2">
              {canApprove ? (
                <>
                  <Button
                    variant="outlineSuccess"
                    size="small"
                    onClick={handleApproveClick}
                    disabled={isProcessing}
                    className="gap-2"
                    data-testid="approval-approveButton"
                  >
                    <CircleCheck className="h-5 w-5" />
                    {t('approve')}
                  </Button>
                  <Button
                    variant="outlineError"
                    size="small"
                    onClick={handleDeclineClick}
                    disabled={isProcessing}
                    className="gap-2"
                    data-testid="approval-declineButton"
                  >
                    <CircleX className="h-5 w-5" />
                    {t('decline')}
                  </Button>
                </>
              ) : null}
              {canComment ? (
                <Button
                  variant="secondary"
                  size="small"
                  onClick={() => setIsCommentFormOpen((isOpen) => !isOpen)}
                  className="gap-2"
                  data-testid="approval-addCommentButton"
                >
                  <MessageSquareText className="h-5 w-5" />
                  {t('addComment')}
                </Button>
              ) : null}
            </div>
          </footer>
        ) : null}

        <footer className="px-6 py-6 sm:px-8">
          <Button variant="neutral" onClick={() => window.history.back()} data-testid="approval-backButton">
            {t('back')}
          </Button>
        </footer>
      </AccountDetailContainer>
    );
  }

  const approveResourceId = approval?.resource.id ?? '';
  const approveNetAmount = approval ? formatApprovalNetAmount(approval, locale) : '-';

  return (
    <>
      {content}
      <ConfirmationDialog
        open={isDeclineDialogOpen}
        onOpenChange={handleDeclineDialogOpenChange}
        title={t('declineApprovalTitle')}
        description={t('declineApprovalDescription')}
        cancelLabel={t('cancel')}
        confirmLabel={t('decline')}
        onCancel={handleCancelDecline}
        onConfirm={() => void handleConfirmDecline()}
        pending={isProcessing}
        testIdPrefix="approval-decline"
      />
      <ConfirmationDialog
        open={isApproveDialogOpen}
        onOpenChange={handleApproveDialogOpenChange}
        title={t('approveApprovalTitle')}
        description={t('approveApprovalDescription', {
          resourceId: approveResourceId,
          netAmount: approveNetAmount,
        })}
        cancelLabel={t('cancel')}
        confirmLabel={t('approve')}
        onCancel={handleCancelApprove}
        onConfirm={() => void handleConfirmApprove()}
        pending={isProcessing}
        confirmVariant="outlineSuccess"
        testIdPrefix="approval-approve"
      />
    </>
  );
}
