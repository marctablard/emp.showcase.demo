'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { useApproverSearch } from '@/hooks/approval/useApproverSearch';
import { useToast } from '@/hooks/ui/useToast';
import type { ApprovalContext } from '@/lib/approval/contracts';
import { getLogger } from '@/lib/logger/use-logger-client';
import type { ApprovalUser } from '@/platform/services/model/approval';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  resourceContext: ApprovalContext;
  approvalSubmit: (approverId: string, comment: string) => Promise<void>;
}

export function ApprovalModal({ isOpen, onClose, resourceContext, approvalSubmit }: ApprovalModalProps) {
  const t = useTranslations('checkout.approval');
  const { toast } = useToast();

  const { approvers, loading, error, refetch } = useApproverSearch({
    resourceType: resourceContext.resourceType,
    resourceId: resourceContext.resourceId,
    action: resourceContext.action,
  });

  const [selectedApprover, setSelectedApprover] = useState<ApprovalUser | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelectApprover = (approver: ApprovalUser) => {
    setSelectedApprover(approver);
  };

  const handleSubmit = async () => {
    if (!selectedApprover) {
      toast({
        title: t('validationError'),
        description: t('selectApproverRequired'),
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await approvalSubmit(selectedApprover.userId, comment);
      onClose();
    } catch (error) {
      getLogger().error({ err: error }, 'Error creating approval request');
      toast({
        title: t('approvalRequestError'),
        description: t('errorCreatingApprovalRequest'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (isOpen && resourceContext.resourceId && !loading && !approvers && !error) {
      refetch();
    }
  }, [isOpen, resourceContext.resourceId, refetch, loading, approvers, error]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('selectApprover')}</DialogTitle>
        </DialogHeader>

        {approvers && approvers.length > 0 && (
          <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-2">
            {approvers.map((approver) => (
              <div
                key={approver.userId}
                className={`flex items-center p-2 rounded-md cursor-pointer ${
                  selectedApprover?.userId === approver.userId
                    ? 'bg-surface-action-hover-2'
                    : 'hover:bg-surface-disabled'
                }`}
                onClick={() => handleSelectApprover(approver)}
                data-testid={`approval-approver-${approver.userId}`}
              >
                <Avatar className="h-8 w-8 mr-2">
                  <div className="bg-surface-action text-text-on-action rounded-full h-full w-full flex items-center justify-center">
                    {approver.firstName?.charAt(0) || approver.lastName?.charAt(0) || 'U'}
                  </div>
                </Avatar>
                <div>
                  <p className="font-medium">
                    {approver.firstName} {approver.lastName}
                  </p>
                  <p className="text-sm text-text-placeholders">{approver.fullName}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="text-center py-2">
            <Spinner className="mr-2 h-4 w-4 inline" /> {t('loadingApprovers')}
          </div>
        )}

        {!loading && approvers?.length === 0 && !error && (
          <div className="text-center text-text-placeholders py-2">{t('noApproversFound')}</div>
        )}

        {!loading && error && (
          <div className="text-center py-4 space-y-2">
            <p className="text-sm text-text-error">{t('errorFetchingApproversDescription')}</p>
            <Button variant="secondary" size="small" onClick={() => refetch()}>
              {t('retry')}
            </Button>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="approval-comment">{t('comment')}</Label>
          <Textarea
            id="approval-comment"
            placeholder={t('commentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            data-testid="approval-comment"
          />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting} data-testid="approval-cancelButton">
            {t('cancel')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedApprover || isSubmitting}
            data-testid="approval-submitButton"
          >
            {isSubmitting ? (
              <>
                <Spinner className="mr-2 h-4 w-4" />
                {t('submitting')}
              </>
            ) : (
              t('submitApprovalRequest')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
