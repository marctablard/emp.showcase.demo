'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { type OrderStatusLowercaseKey, dk } from '@/i18n/dynamic-key';
import { getOrderStatusVariant } from '@/lib/common/status-tag-variants';
import type { Order } from '@/platform/services/model/order/order';

/**
 * Order status tag — Figma Molecules / Tags; list and detail must stay aligned.
 */
export function OrderStatusBadge({ status }: { status: Order['status'] }) {
  const t = useTranslations('orders');

  return (
    <Badge variant={getOrderStatusVariant(status)} size="status">
      {t(dk<OrderStatusLowercaseKey>(`status.${status.toLowerCase()}`))}
    </Badge>
  );
}

export { getOrderStatusVariant } from '@/lib/common/status-tag-variants';
