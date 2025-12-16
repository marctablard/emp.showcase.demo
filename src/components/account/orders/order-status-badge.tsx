'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Order } from '@/platform/services/model/order/order';

/**
 * Order status badge component
 * Displays a badge with appropriate color based on order status
 */
export function OrderStatusBadge({ status }: { status: Order['status'] }) {
  const tOrderStatus = useTranslations('orders.OrderStatus');

  const getVariant = () => {
    switch (status) {
      case 'COMPLETED':
        return 'success';
      case 'SHIPPED':
      case 'DELIVERED':
        return 'secondary';
      case 'CONFIRMED':
        return 'secondary';
      case 'CREATED':
        return 'default';
      case 'CANCELLED':
        return 'destructive';
      case 'PROCESSING':
      case 'READY_FOR_PICKUP':
      case 'READY_FOR_SHIPPING':
        return 'warning';
      default:
        return 'outline';
    }
  };

  return <Badge variant={getVariant()}>{tOrderStatus(status)}</Badge>;
}
