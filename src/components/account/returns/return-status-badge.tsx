'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { getReturnStatusVariant } from '@/lib/common/status-tag-variants';
import { ReturnStatus } from '@/platform/services/model/return';

interface ReturnStatusBadgeProps {
  status: ReturnStatus;
  isExpired?: boolean;
}

export function ReturnStatusBadge({ status, isExpired }: ReturnStatusBadgeProps) {
  const t = useTranslations('account.returns.status');

  if (isExpired) {
    return (
      <Badge variant="outline" size="status" className="bg-surface-secondary">
        {t('EXPIRED')}
      </Badge>
    );
  }

  return (
    <Badge variant={getReturnStatusVariant(status)} size="status">
      {t(status)}
    </Badge>
  );
}

export { getReturnStatusVariant } from '@/lib/common/status-tag-variants';
