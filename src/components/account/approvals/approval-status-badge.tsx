'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { ApprovalStatus } from '@/platform/services/model/approval';

interface ApprovalStatusBadgeProps {
  status: ApprovalStatus;
}

export function ApprovalStatusBadge({ status }: ApprovalStatusBadgeProps) {
  const t = useTranslations('orders.ApprovalStatus');

  const getVariant = () => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'DECLINED':
        return 'destructive';
      case 'EXPIRED':
        return 'outline';
      case 'CLOSED':
        return 'secondary';
      default:
        return 'default';
    }
  };

  return <Badge variant={getVariant() as any}>{t(status)}</Badge>;
}
