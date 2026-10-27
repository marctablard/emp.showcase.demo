'use client';

import { useTranslations } from 'next-intl';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import type { SubscriptionStatus } from '@/platform/services/subscription/subscription-rules';

function variantFor(status: SubscriptionStatus): BadgeVariant {
  if (status === 'ACTIVE') return 'success';
  if (status === 'PAUSED') return 'warning';
  return 'muted';
}

export function SubscriptionStatusBadge({
  status,
  emphasized = false,
}: {
  status: SubscriptionStatus;
  emphasized?: boolean;
}) {
  const t = useTranslations('account.subscriptions');
  return (
    <Badge
      variant={variantFor(status)}
      size="status"
      className={emphasized ? 'h-10 min-h-10 px-6 text-sm tracking-[1.5px] shadow-sm' : undefined}
    >
      {t(`status.${status}`)}
    </Badge>
  );
}
