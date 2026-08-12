'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ApproverSelectList } from '@/components/approval/approver-select-list';
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
  const commentRef = useRef<HTMLTextAreaElement | null>(null);

  const { approvers, loading, error, refetch } = useApproverSearch({
    resourceType: resourceContext.resourceType,
    resourceId: resourceContext.resourceId,
    action: resourceContext.action,
  });

  const [selectedApprover, setSelectedApprover] = useState<ApprovalUser | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetAndClose = () => {
    setSelectedApprover(null);
    setComment('');
    onClose();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetAndClose();
    }
  };

  const handleSelectApprover = (userId: string) => {
    const approver = approvers?.find((candidate) => candidate.userId === userId);
    if (approver) {
      setSelectedApprover(approver);
    }
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
      resetAndClose();
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
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-[500px]"
        aria-describedby={undefined}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          commentRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('selectApprover')}</DialogTitle>
        </DialogHeader>

        {approvers && approvers.length > 0 && (
          <ApproverSelectList
            approvers={approvers}
            selectedUserId={selectedApprover?.userId ?? null}
            onSelect={handleSelectApprover}
            testIdPrefix="approval-approver"
          />
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
            ref={commentRef}
            id="approval-comment"
            placeholder={t('commentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            maxLength={500}
            data-testid="approval-comment"
          />
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="secondary"
            className="w-full sm:w-auto"
            onClick={resetAndClose}
            disabled={isSubmitting}
            data-testid="approval-cancelButton"
          >
            {t('cancel')}
          </Button>
          <Button
            className="w-full sm:w-auto"
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
