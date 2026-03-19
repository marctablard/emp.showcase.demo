'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useApproval } from '@/hooks/approval/useApproval';
import { Approval } from '@/platform/services/model/approval';
import { ApprovalStatusBadge } from './approval-status-badge';

interface ApprovalDetailsProps {
  approvalId: string;
  initialApproval?: Approval;
}

export function ApprovalDetails({ approvalId, initialApproval }: ApprovalDetailsProps) {
  const t = useTranslations('orders.Approval');
  const tStatus = useTranslations('orders.ApprovalStatus');
  const [approverComment, setApproverComment] = useState<string>('');
  const [requestorComment, setRequestorComment] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const {
    approval,
    loading,
    error,
    updateApprovalStatus,
    updateApproverComment,
    updateRequestorComment,
    deleteApproval,
    refreshApproval,
  } = useApproval(approvalId, initialApproval);

  const handleApprove = async () => {
    try {
      setActionError(null);
      await updateApprovalStatus('APPROVED');
      setActionSuccess(t('approvalSuccessfullyApproved'));

      if (approverComment) {
        await updateApproverComment(approverComment);
        setApproverComment('');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDecline = async () => {
    try {
      setActionError(null);
      await updateApprovalStatus('DECLINED');
      setActionSuccess(t('approvalSuccessfullyDeclined'));

      if (approverComment) {
        await updateApproverComment(approverComment);
        setApproverComment('');
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleUpdateApproverComment = async () => {
    try {
      setActionError(null);
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
      await updateRequestorComment(requestorComment);
      setActionSuccess(t('requestorCommentUpdated'));
      setRequestorComment('');
    } catch (err) {
      setActionError(err instanceof Error ? err.message : String(err));
    }
  };

  const handleDelete = async () => {
    if (confirm(t('confirmDeleteApproval'))) {
      try {
        setActionError(null);
        await deleteApproval();
        setActionSuccess(t('approvalSuccessfullyDeleted'));
      } catch (err) {
        setActionError(err instanceof Error ? err.message : String(err));
      }
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  // This view intentionally only updates approval status without triggering checkout.
  // The main approval view at /account/approvals/[id] handles the full checkout + order
  // submission flow. See SHOW-298 for context on this distinction.
  const canApprove = approval?.status === 'PENDING';
  const canComment = approval?.status !== 'CLOSED' && approval?.status !== 'EXPIRED';

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
    <Card>
      <CardHeader>
        <div className="flex justify-between items-start">
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
            <p className="text-base">{approval.resource.id}</p>
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
                <Button onClick={handleApprove} className="bg-surface-success hover:bg-surface-action-hover-2">
                  {t('approve')}
                </Button>
                <Button onClick={handleDecline} variant="secondary">
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
              <p className="text-sm font-medium mb-2">{t('addApproverComment')}</p>
              <Textarea
                value={approverComment}
                onChange={(e) => setApproverComment(e.target.value)}
                placeholder={t('enterApproverComment')}
                className="mb-2"
              />
              <Button onClick={handleUpdateApproverComment} disabled={!approverComment.trim()}>
                {t('saveApproverComment')}
              </Button>
            </div>

            <div>
              <p className="text-sm font-medium mb-2">{t('addRequestorComment')}</p>
              <Textarea
                value={requestorComment}
                onChange={(e) => setRequestorComment(e.target.value)}
                placeholder={t('enterRequestorComment')}
                className="mb-2"
              />
              <Button onClick={handleUpdateRequestorComment} disabled={!requestorComment.trim()}>
                {t('saveRequestorComment')}
              </Button>
            </div>
          </>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="neutral" onClick={() => window.history.back()}>
          {t('back')}
        </Button>
        <Button variant="secondary" onClick={handleDelete}>
          {t('delete')}
        </Button>
      </CardFooter>
    </Card>
  );
}
