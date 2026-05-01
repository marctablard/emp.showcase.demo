import type { BadgeVariant } from '@/components/ui/badge';
import type { ApprovalStatus } from '@/platform/services/model/approval';
import type { Order } from '@/platform/services/model/order/order';
import { ORDER_STATUS } from '@/platform/services/model/order/order-status';
import type { QuoteStatus } from '@/platform/services/model/quote';
import type { ReturnStatus } from '@/platform/services/model/return';

enum OrderStatusTag {
  IN_CHECKOUT = 'IN_CHECKOUT',
  CREATED = 'CREATED',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  READY_FOR_PICKUP = 'READY_FOR_PICKUP',
  READY_FOR_SHIPPING = 'READY_FOR_SHIPPING',
  SHIPPED = 'SHIPPED',
  DELIVERED = 'DELIVERED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
  DECLINED = 'DECLINED',
}

enum QuoteStatusTag {
  CREATING = 'CREATING',
  AWAITING = 'AWAITING',
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  DECLINED = 'DECLINED',
  ACCEPTED = 'ACCEPTED',
  ORDER_CREATED = 'ORDER_CREATED',
  CLOSED = 'CLOSED',
  CHANGE = 'CHANGE',
  DECLINE = 'DECLINE',
  DECLINED_BY_MERCHANT = 'DECLINED_BY_MERCHANT',
  EXPIRED = 'EXPIRED',
}

enum ReturnStatusTag {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
  REJECTED = 'REJECTED',
  REVIEWED = 'REVIEWED',
  CLOSED = 'CLOSED',
}

enum ApprovalStatusTag {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  CLOSED = 'CLOSED',
  EXPIRED = 'EXPIRED',
  DECLINED = 'DECLINED',
}

const _orderStatusTagExhaustive: Record<Order['status'], true> = {
  [OrderStatusTag.IN_CHECKOUT]: true,
  [OrderStatusTag.CREATED]: true,
  [OrderStatusTag.CONFIRMED]: true,
  [OrderStatusTag.PROCESSING]: true,
  [OrderStatusTag.READY_FOR_PICKUP]: true,
  [OrderStatusTag.READY_FOR_SHIPPING]: true,
  [OrderStatusTag.SHIPPED]: true,
  [OrderStatusTag.DELIVERED]: true,
  [OrderStatusTag.COMPLETED]: true,
  [OrderStatusTag.CANCELLED]: true,
  [OrderStatusTag.DECLINED]: true,
};

void _orderStatusTagExhaustive;

const _quoteStatusTagExhaustive: Record<QuoteStatus, true> = {
  [QuoteStatusTag.CREATING]: true,
  [QuoteStatusTag.AWAITING]: true,
  [QuoteStatusTag.OPEN]: true,
  [QuoteStatusTag.IN_PROGRESS]: true,
  [QuoteStatusTag.DECLINED]: true,
  [QuoteStatusTag.ACCEPTED]: true,
  [QuoteStatusTag.ORDER_CREATED]: true,
  [QuoteStatusTag.CLOSED]: true,
  [QuoteStatusTag.CHANGE]: true,
  [QuoteStatusTag.DECLINE]: true,
  [QuoteStatusTag.DECLINED_BY_MERCHANT]: true,
  [QuoteStatusTag.EXPIRED]: true,
};

void _quoteStatusTagExhaustive;

const _returnStatusTagExhaustive: Record<ReturnStatus, true> = {
  [ReturnStatusTag.APPROVED]: true,
  [ReturnStatusTag.PENDING]: true,
  [ReturnStatusTag.REJECTED]: true,
  [ReturnStatusTag.REVIEWED]: true,
  [ReturnStatusTag.CLOSED]: true,
};

void _returnStatusTagExhaustive;

const _approvalStatusTagExhaustive: Record<ApprovalStatus, true> = {
  [ApprovalStatusTag.PENDING]: true,
  [ApprovalStatusTag.APPROVED]: true,
  [ApprovalStatusTag.CLOSED]: true,
  [ApprovalStatusTag.EXPIRED]: true,
  [ApprovalStatusTag.DECLINED]: true,
};

void _approvalStatusTagExhaustive;

export function isOrderStatusValue(value: string): value is Order['status'] {
  return Object.prototype.hasOwnProperty.call(ORDER_STATUS, value);
}

export function isQuoteStatusValue(value: string): value is QuoteStatus {
  return (Object.values(QuoteStatusTag) as string[]).includes(value);
}

export function isReturnStatusValue(value: string): value is ReturnStatus {
  return (Object.values(ReturnStatusTag) as string[]).includes(value);
}

export function isApprovalStatusValue(value: string): value is ApprovalStatus {
  return (Object.values(ApprovalStatusTag) as string[]).includes(value);
}

/** Maps every {@link Order['status']}; default covers malformed strings (e.g. AI). */
export function getOrderStatusVariant(status: Order['status']): BadgeVariant {
  switch (status) {
    case OrderStatusTag.IN_CHECKOUT:
      return 'outline';
    case OrderStatusTag.CREATED:
      return 'information';
    case OrderStatusTag.CONFIRMED:
    case OrderStatusTag.SHIPPED:
      return 'success';
    case OrderStatusTag.DELIVERED:
      return 'muted';
    case OrderStatusTag.PROCESSING:
    case OrderStatusTag.READY_FOR_PICKUP:
    case OrderStatusTag.READY_FOR_SHIPPING:
      return 'warning';
    case OrderStatusTag.COMPLETED:
      return 'muted';
    case OrderStatusTag.CANCELLED:
    case OrderStatusTag.DECLINED:
      return 'destructive';
    default:
      return 'outline';
  }
}

/**
 * Maps every {@link QuoteStatus} to a {@link BadgeVariant}.
 * Canonical storefront tags (Figma Molecules / Quote Statuses): CREATING, AWAITING, OPEN (information);
 * IN_PROGRESS (warning); ACCEPTED (success); DECLINED, DECLINED_BY_MERCHANT (destructive); EXPIRED (outline).
 * Legacy Emporix values ORDER_CREATED, CLOSED, CHANGE, DECLINE keep distinct variants until product removes them.
 */
export function getQuoteStatusVariant(status: QuoteStatus): BadgeVariant {
  switch (status) {
    case QuoteStatusTag.CREATING:
    case QuoteStatusTag.AWAITING:
      return 'information';
    case QuoteStatusTag.CLOSED:
      return 'muted';
    case QuoteStatusTag.EXPIRED:
      return 'outline';
    case QuoteStatusTag.OPEN:
      return 'information';
    case QuoteStatusTag.IN_PROGRESS:
      return 'warning';
    case QuoteStatusTag.DECLINED:
    case QuoteStatusTag.CHANGE:
    case QuoteStatusTag.DECLINE:
    case QuoteStatusTag.DECLINED_BY_MERCHANT:
      return 'destructive';
    case QuoteStatusTag.ACCEPTED:
    case QuoteStatusTag.ORDER_CREATED:
      return 'success';
    default:
      return 'outline';
  }
}

/** Maps every {@link ReturnStatus}. */
export function getReturnStatusVariant(status: ReturnStatus): BadgeVariant {
  switch (status) {
    case ReturnStatusTag.APPROVED:
      return 'success';
    case ReturnStatusTag.PENDING:
    case ReturnStatusTag.REVIEWED:
      return 'warning';
    case ReturnStatusTag.REJECTED:
      return 'destructive';
    case ReturnStatusTag.CLOSED:
      return 'muted';
    default:
      return 'default';
  }
}

/** Maps every {@link ApprovalStatus}; default covers unknown runtime values. */
export function getApprovalStatusVariant(status: ApprovalStatus): BadgeVariant {
  switch (status) {
    case ApprovalStatusTag.APPROVED:
      return 'success';
    case ApprovalStatusTag.PENDING:
      return 'warning';
    case ApprovalStatusTag.DECLINED:
      return 'destructive';
    case ApprovalStatusTag.EXPIRED:
      return 'muted';
    case ApprovalStatusTag.CLOSED:
      return 'muted';
    default:
      return 'default';
  }
}
