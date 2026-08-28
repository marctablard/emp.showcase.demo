'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { CircleAlert, CircleCheck, CircleX, MessageSquareText } from 'lucide-react';
import { resolveApprovalTotalNetAmount } from '@/components/account/approvals/approval-net-amount';
import { ApprovalSummary } from '@/components/account/approvals/approval-summary';
import { resolveItemDiscountPercent } from '@/components/account/shared/item-discount';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmationDialog } from '@/components/ui/confirmation-dialog';
import { H3, H4, H5 } from '@/components/ui/h';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { ToastType, notify } from '@/components/ui/toast-notification';
import { useApproval } from '@/hooks/approval/useApproval';
import useCustomer from '@/hooks/customer/useCustomer';
import { useToast } from '@/hooks/ui/useToast';
import { Link } from '@/i18n/navigation';
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

export function ApprovalDetails({ approvalId, initialApproval }: ApprovalDetailsProps) {
  const locale = useLocale();
  const t = useTranslations('orders.Approval');
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
  } else if (error || !approval) {
    content = (
      <Card>
        <CardHeader>
          <CardTitle>{t('approvalDetails')}</CardTitle>
          <CardDescription>{t('approvalDetailsDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-surface-error p-4 rounded-md text-text-error">
            {t('errorLoadingApproval')}: {error?.message || t('approvalNotFound')}
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => refreshApproval()}>{t('tryAgain')}</Button>
        </CardFooter>
      </Card>
    );
  } else {
    const canApprove = approval.status === 'PENDING' && isDesignatedApprover && !isRequestor;
    const canComment = approval.status === 'PENDING' && (isRequestor || isDesignatedApprover);

    content = (
      <div className="space-y-6">
        {/* Header: mobile stacks full-width CTAs (Figma 11895:141280); from sm, actions stay one
            horizontal row and wrap as a unit under the ID band when space is tight (11895:138491). */}
        <div
          className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          data-testid="approval-detail-header"
        >
          <div className="flex min-w-0 flex-nowrap items-center gap-6">
            <H3 className="min-w-0 break-words">
              {t('approval')}: {approval.id}
            </H3>
            <div className="shrink-0">
              <ApprovalStatusBadge status={approval.status} />
            </div>
          </div>
          <div
            className="flex w-full shrink-0 flex-col gap-4 sm:w-auto sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end"
            data-testid="approval-detail-actions"
          >
            {canApprove && (
              <>
                <Button
                  variant="outlineError"
                  size="small"
                  onClick={handleDeclineClick}
                  disabled={isProcessing}
                  className="w-full gap-2 sm:w-auto"
                >
                  <CircleX className="h-5 w-5" />
                  {t('decline')}
                </Button>
                <Button
                  variant="outlineSuccess"
                  size="small"
                  onClick={handleApproveClick}
                  disabled={isProcessing}
                  className="w-full gap-2 sm:w-auto"
                >
                  <CircleCheck className="h-5 w-5" />
                  {t('approve')}
                </Button>
              </>
            )}
            {canComment && (
              <Button
                variant="secondary"
                size="small"
                onClick={() => setIsCommentFormOpen((isOpen) => !isOpen)}
                className="w-full gap-2 sm:w-auto"
              >
                <MessageSquareText className="h-5 w-5" />
                {t('addComment')}
              </Button>
            )}
          </div>
        </div>

        {actionError && (
          <Alert variant="destructive">
            <CircleAlert className="h-4 w-4" />
            <AlertTitle>{t('error')}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        <div className="rounded-md bg-surface-primary p-6 shadow-sm">
          <H4 className="mb-4">{t('approvalDetails')}</H4>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <H5>{t('createdAt')}</H5>
                <span className="text-base font-body text-text-body">{formatDate(approval.createdAt)}</span>
              </div>
              <div className="flex flex-col gap-1">
                <H5>{t('totalNetAmount')}</H5>
                <span className="text-base font-body text-text-body">{formatApprovalNetAmount(approval, locale)}</span>
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <H5>{t('requestedBy')}</H5>
                <span className="text-base font-body text-text-body">
                  {approval.requestor.firstName} {approval.requestor.lastName}
                </span>
              </div>
              <div className="flex flex-col gap-1">
                <H5>{approval.resourceType === 'QUOTE' ? t('relatedQuote') : t('relatedOrder')}</H5>
                {approval.resourceType === 'QUOTE' ? (
                  <Link
                    href={`/account/quotes/${approval.resource.id}`}
                    className="text-base font-body text-text-action"
                  >
                    {approval.resource.id}
                  </Link>
                ) : (
                  <span className="text-base font-body text-text-body">
                    {approval.resource.orderId || approval.resource.id}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {canComment && isCommentFormOpen && (
          <div className="rounded-md bg-surface-primary p-6 shadow-sm">
            <H4 className="mb-4">{t('addComment')}</H4>
            <div>
              <Textarea
                ref={commentTextareaRef}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('enterComment')}
                className="mb-2"
              />
              <div className="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setIsCommentFormOpen(false)}>
                  {t('back')}
                </Button>
                <Button onClick={handleComment} disabled={!comment.trim()}>
                  {t('saveComment')}
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="min-w-0 rounded-md bg-surface-primary p-4 shadow-sm" data-testid="approval-history">
          <H4 className="mb-4">{t('approvalHistory')}</H4>
          <div className="min-w-0 overflow-x-auto" data-testid="approval-history-table-scroll">
            {/* Column mins (~840px) + gap-6 × 4 ≈ 936px — keep sm+ table width; scroll instead of overflow. */}
            <div className="sm:min-w-[940px]">
              <div className="hidden grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] gap-6 border-b border-border-primary pb-4 sm:grid">
                <span className="text-sm font-bold text-text-headings">{t('date')}</span>
                <span className="text-sm font-bold text-text-headings">{t('event')}</span>
                <span className="text-sm font-bold text-text-headings">{t('changedBy')}</span>
                <span className="text-sm font-bold text-text-headings">{t('comment')}</span>
                <span className="text-sm font-bold text-text-headings">{t('changeReason')}</span>
              </div>
              {/* Approver comment is a separate top row (finding 25) — never mixed with requestor comment. */}
              {approval.approverComment ? (
                <div
                  className="grid grid-cols-1 gap-3 py-4 text-base font-body text-text-body sm:grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] sm:gap-6"
                  data-testid="approval-history-approver-comment"
                >
                  <span>-</span>
                  <span>{t('approverComment')}</span>
                  <span>
                    {approval.approver.firstName} {approval.approver.lastName} ({t('roleApprover')})
                  </span>
                  <span>{approval.approverComment}</span>
                  <span>-</span>
                </div>
              ) : null}
              <div
                className="grid grid-cols-1 gap-3 py-4 text-base font-body text-text-body sm:grid-cols-[minmax(140px,1fr)_minmax(220px,2fr)_minmax(160px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)] sm:gap-6"
                data-testid="approval-history-request"
              >
                <span>{formatDate(approval.createdAt)}</span>
                <span>{t('approvalRequestCreated')}</span>
                <span>
                  {approval.requestor.firstName} {approval.requestor.lastName} ({t('roleCustomer')})
                </span>
                <span>{approval.comment || '-'}</span>
                <span>-</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <ApprovalSummary approval={approval} />

          {approval.resource.items && approval.resource.items.length > 0 && (
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
          )}
        </div>
      </div>
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
      />
    </>
  );
}
