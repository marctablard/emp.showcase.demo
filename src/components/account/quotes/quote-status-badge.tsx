'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { type QuoteStatusKey, dk } from '@/i18n/dynamic-key';
import { getQuoteStatusVariant } from '@/lib/common/status-tag-variants';
import type { QuoteStatus } from '@/platform/services/model/quote';

interface QuoteStatusBadgeProps {
  status: QuoteStatus;
}

/**
 * Quote status tag — aligned with Figma Molecules / Tags.
 */
export function QuoteStatusBadge({ status }: QuoteStatusBadgeProps) {
  const t = useTranslations('account.quoteStatus');

  return (
    <Badge variant={getQuoteStatusVariant(status)} size="status">
      {t(dk<QuoteStatusKey>(status.toLowerCase()))}
    </Badge>
  );
}

export { getQuoteStatusVariant } from '@/lib/common/status-tag-variants';
