'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { type QuoteStatusKey, dk } from '@/i18n/dynamic-key';
import type { QuoteStatus } from '@/platform/services/model/quote';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
}

/**
 * Badge component for displaying quote status with appropriate styling
 */
export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  const t = useTranslations('account.quoteStatus');

  // Get the appropriate status badge variant similar to order badges
  const getStatusVariant = (status: QuoteStatus) => {
    switch (status) {
      case 'CREATING':
        return { variant: 'outline' as const };
      case 'OPEN':
        return { variant: 'info' as const };
      case 'IN_PROGRESS':
        return { variant: 'warning' as const };
      case 'DECLINED':
        return { variant: 'destructive' as const };
      case 'ACCEPTED':
        return { variant: 'success' as const };
      case 'ORDER_CREATED':
        return { variant: 'success' as const };
      case 'CLOSED':
        return { variant: 'outline' as const };
      default:
        return { variant: 'outline' as const };
    }
  };

  return (
    <Badge variant={getStatusVariant(status).variant} className="uppercase">
      {t(dk<QuoteStatusKey>(status.toLowerCase()))}
    </Badge>
  );
}
