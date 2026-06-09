import type { ApprovalAction, ApprovalCreateRequest, ApprovalResourceType } from '@/platform/services/model/approval';

export interface ApprovalContext {
  resourceType: ApprovalResourceType;
  resourceId: string;
  action: ApprovalAction;
}

export interface QuoteApprovalSelection {
  approverId: string;
  comment?: string;
}

const approvalResourceTypes = ['CART', 'QUOTE'] as const;
const approvalActions = ['CHECKOUT'] as const;

export const isApprovalResourceType = (value: string): value is ApprovalResourceType =>
  approvalResourceTypes.includes(value as ApprovalResourceType);

export const isApprovalAction = (value: string): value is ApprovalAction =>
  approvalActions.includes(value as ApprovalAction);

export const createCheckoutApprovalContext = (cartId: string): ApprovalContext => ({
  resourceType: 'CART',
  resourceId: cartId,
  action: 'CHECKOUT',
});

export const createQuoteApprovalContext = (quoteId: string): ApprovalContext => ({
  resourceType: 'QUOTE',
  resourceId: quoteId,
  action: 'CHECKOUT',
});

export const createQuoteApprovalRequest = (
  quoteId: string,
  selection: QuoteApprovalSelection,
): ApprovalCreateRequest => ({
  resourceType: 'QUOTE',
  resourceId: quoteId,
  action: 'CHECKOUT',
  approver: {
    userId: selection.approverId,
  },
  comment: selection.comment,
});
