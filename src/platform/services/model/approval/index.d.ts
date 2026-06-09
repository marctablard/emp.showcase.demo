/**
 * Service layer models for approval functionality
 */
import { CheckoutAddress, OrderShipping } from '../checkout';
import { Address } from '../common';

export interface ApprovalUser {
  userId: string;
  firstName: string;
  lastName: string;
  fullName?: string;
}

export interface ApprovalRequestor extends ApprovalUser {
  email: string;
}

export interface ApprovalPrice {
  currency: string;
  amount: number;
  formattedAmount?: string;
}

export interface ApprovalTaxablePrice {
  currency: string;
  netValue: number;
  grossValue: number;
  taxValue: number;
  formattedNetValue?: string;
  formattedGrossValue?: string;
  formattedTaxValue?: string;
}

export interface ApprovalDeliveryWindow {
  id: string;
  slotId: string;
  deliveryDate: string;
  formattedDeliveryDate?: string;
}

export interface ApprovalResourceItem {
  quantity: number;
  itemPrice: ApprovalPrice;
  itemYrn?: string;
  itemId?: string;
  productId?: string;
  productName?: string | LocalizedString;
}

export interface ApprovalResource {
  id: string;
  orderId?: string;
  items?: ApprovalResourceItem[];
  totalPrice?: ApprovalPrice;
  subTotalPrice?: ApprovalPrice;
  subtotalAggregate?: ApprovalTaxablePrice;
  amount?: number;
  siteCode?: string;
  deliveryWindow?: ApprovalDeliveryWindow;
}

export interface ApprovalPaymentMethod {
  provider: string;
  customAttributes?: Record<string, any>;
  method: string;
  amount: number;
  formattedAmount?: string;
}

export interface ApprovalPayment {
  paymentId: string;
  customAttributes?: Record<string, any>;
}

export interface ApprovalDetails {
  currency: string;
  paymentMethods?: CheckoutPaymentMethod[];
  shipping?: OrderShipping;
  payment?: CheckoutPayment;
  addresses?: CheckoutAddress[];
}

export type ApprovalResourceType = 'CART' | 'QUOTE';
export type ApprovalAction = 'CHECKOUT';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'CLOSED' | 'EXPIRED' | 'DECLINED';

export interface ApprovalBase {
  resourceType: ApprovalResourceType;
  action: ApprovalAction;
  approver: Partial<ApprovalUser>;
  comment?: string;
  details?: ApprovalDetails;
}

export interface ApprovalCreateRequest extends ApprovalBase {
  id?: string;
  resourceId: string;
}

export interface Approval extends ApprovalBase {
  id: string;
  approverComment?: string;
  resource: ApprovalResource;
  requestor: ApprovalRequestor;
  approver: ApprovalUser;
  createdAt: string;
  modifiedAt?: string;
  updatedAt?: string;
  status: ApprovalStatus;
  expiryDate?: string;
  version?: number;
}

export interface ApprovalId {
  id: string;
}

export interface ApprovalPermittedRequest {
  resourceType: ApprovalResourceType;
  resourceId: string;
  action: ApprovalAction;
}

export interface ApprovalPermittedResponse {
  action: ApprovalAction;
  status?: ApprovalStatus;
  permitted: boolean;
  approvalId?: string;
}

export type ApprovalUpdateOperation = 'ADD' | 'REMOVE' | 'REPLACE';
export type ApprovalUpdatePath = '/status' | '/details' | '/comment' | '/approverComment' | '/resource/deliveryWindow';

export interface ApprovalUpdateRequest {
  op: ApprovalUpdateOperation;
  path: ApprovalUpdatePath | string;
  value: ApprovalStatus | string | Record<string, any>;
}
