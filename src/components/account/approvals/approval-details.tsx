'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { ApprovalSummary } from '@/components/account/approvals/approval-summary';
import { ProductListResolver } from '@/components/product/product-list-resolver';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useApproval } from '@/hooks/approval/useApproval';
import useCustomer from '@/hooks/customer/useCustomer';
import { useToast } from '@/hooks/ui/useToast';
import { Link } from '@/i18n/navigation';
import { checkoutApproval as checkoutApi } from '@/lib/client/checkout';
import type { Approval } from '@/platform/services/model/approval';
import type { CheckoutRequest } from '@/platform/services/model/checkout';
import { ApprovalStatusBadge } from './approval-status-badge';

interface ApprovalDetailsProps {
  approvalId: string;
  initialApproval?: Approval;
}

export function ApprovalDetails({ approvalId, initialApproval }: ApprovalDetailsProps) {
  const locale = useLocale();
  const t = useTranslations('orders.Approval');
  const tStatus = useTranslations('orders.ApprovalStatus');
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

      // Navigate after successful approve + checkout
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

  if (error || !approval) {
    return (
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
  }

  const isDesignatedApprover = approval.approver.userId === customer?.id;
  const canApprove = approval.status === 'PENDING' && isDesignatedApprover && !isRequestor;
  const canComment = approval.status === 'PENDING';
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <CardTitle>{t('approvalDetails')}</CardTitle>
            <CardDescription>{t('approvalDetailsDescription')}</CardDescription>
          </div>
          <ApprovalStatusBadge status={approval.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {actionSuccess && (
          <Alert variant="default" className="mb-4">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>{t('success')}</AlertTitle>
            <AlertDescription>{actionSuccess}</AlertDescription>
          </Alert>
        )}

        {actionError && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>{t('error')}</AlertTitle>
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('id')}</p>
            <p className="text-base">{approval.id}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('status')}</p>
            <p className="text-base">{tStatus(approval.status)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('resourceType')}</p>
            <p className="text-base">{approval.resourceType}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('resourceId')}</p>
            <p className="text-base">
              {approval.resourceType === 'QUOTE' ? (
                <Link href={`/account/quotes/${approval.resource.id}`} className="underline">
                  {approval.resource.id}
                </Link>
              ) : (
                approval.resource.id
              )}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('action')}</p>
            <p className="text-base">{approval.action}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('createdAt')}</p>
            <p className="text-base">{formatDate(approval.createdAt)}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('requestorId')}</p>
            <p className="text-base">{approval.requestor.userId}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-text-placeholders">{t('approverId')}</p>
            <p className="text-base">{approval.approver.userId}</p>
          </div>
          {approval.updatedAt && (
            <div>
              <p className="text-sm font-medium text-text-placeholders">{t('updatedAt')}</p>
              <p className="text-base">{formatDate(approval.updatedAt)}</p>
            </div>
          )}
        </div>

        <Separator />

        <ApprovalSummary approval={approval} />

        {approval.resource.items && approval.resource.items.length > 0 && (
          <ProductListResolver
            items={approval.resource.items.map((it) => ({
              productId: it.productId,
              itemYrn: it.itemYrn,
              quantity: it.quantity,
              unitPrice: it.itemPrice.amount,
              currency: it.itemPrice.currency,
            }))}
          />
        )}

        <div>
          <p className="text-sm font-medium mb-2">{t('requestorComment')}</p>
          {approval.comment ? (
            <div className="bg-surface-disabled p-3 rounded-md">{approval.comment}</div>
          ) : (
            <p className="text-text-placeholders">{t('noRequestorComment')}</p>
          )}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">{t('approverComment')}</p>
          {approval.approverComment ? (
            <div className="bg-surface-disabled p-3 rounded-md">{approval.approverComment}</div>
          ) : (
            <p className="text-text-placeholders">{t('noApproverComment')}</p>
          )}
        </div>

        {canApprove && (
          <>
            <Separator />

            <div>
              <p className="text-sm font-medium mb-2">{t('approvalActions')}</p>
              <div className="flex gap-2">
                <Button
                  onClick={handleApprove}
                  disabled={isProcessing}
                  className="bg-surface-success hover:bg-surface-action-hover-2"
                >
                  {t('approve')}
                </Button>
                <Button onClick={handleDecline} disabled={isProcessing} variant="secondary">
                  {t('decline')}
                </Button>
              </div>
            </div>
          </>
        )}

        {canComment && (
          <>
            <Separator />

            <div>
              <p className="text-sm font-medium mb-2">{t('addComment')}</p>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t('enterComment')}
                className="mb-2"
              />
              <Button onClick={handleComment} disabled={!comment.trim()}>
                {t('saveComment')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="neutral" onClick={() => window.history.back()}>
          {t('back')}
        </Button>
      </CardFooter>
    </Card>
  );
}
