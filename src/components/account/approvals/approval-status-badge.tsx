'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { getApprovalStatusVariant } from '@/lib/common/status-tag-variants';
import { ApprovalStatus } from '@/platform/services/model/approval';

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
  className?: string;
}

export function ApprovalStatusBadge({ status, className }: ApprovalStatusBadgeProps) {
  const t = useTranslations('orders.ApprovalStatus');

  return (
    <Badge variant={getApprovalStatusVariant(status)} size="status" className={className}>
      {t(status)}
    </Badge>
  );
}

export { getApprovalStatusVariant } from '@/lib/common/status-tag-variants';
