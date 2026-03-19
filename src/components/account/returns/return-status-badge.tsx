'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { ReturnStatus } from '@/platform/services/model/return';

type BadgeVariant = 'default' | 'success' | 'secondary' | 'warning' | 'destructive' | 'outline';

interface ReturnStatusBadgeProps {
  status: ReturnStatus;
  isExpired?: boolean;
}

export function ReturnStatusBadge({ status, isExpired }: ReturnStatusBadgeProps) {
  const t = useTranslations('account.returns.status');

  const baseClassName =
    'h-7 px-4 !py-1 !text-[12px] !leading-[12px] font-bold uppercase !tracking-[2px] rounded-[4px] text-text-headings border font-primary';

  if (isExpired) {
    return (
      <Badge variant="outline" className={`${baseClassName} bg-surface-secondary border-border-primary`}>
        {t('EXPIRED')}
      </Badge>
    );
  }

  const getVariant = (): BadgeVariant => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'REJECTED':
        return 'destructive';
      case 'CLOSED':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const getStatusClassName = (): string => {
    switch (status) {
      case 'APPROVED':
        return 'bg-surface-success border-border-success';
      case 'PENDING':
        return 'bg-surface-warning border-border-warning';
      case 'REJECTED':
        return 'bg-surface-error border-border-error';
      case 'CLOSED':
        return 'bg-surface-secondary border-border-primary';
      default:
        return 'bg-surface-primary border-border-primary';
    }
  };

  return (
    <Badge variant={getVariant()} className={`${baseClassName} ${getStatusClassName()}`}>
      {t(status)}
    </Badge>
  );
}
