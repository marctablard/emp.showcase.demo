/**
 * Models for the Emporix Approval API
 */
import { EmporixCheckoutAddress, EmporixCheckoutPaymentMethod, EmporixShipping } from './checkout';
import { EmporixAddress, Metadata } from './common';
import { EmporixPayment } from './order';
import { EmporixPaymentMode } from './payment';

export interface EmporixApprovalUser {
  userId: string;
  firstName: string;
  lastName: string;
  email?: string;
}

export interface EmporixApprovalRequestor extends EmporixApprovalUser {
  email: string;
}

export interface EmporixApprovalPrice {
  currency: string;
  amount: number;
}

export interface EmporixApprovalTaxablePrice {
  currency: string;
  netValue: number;
  grossValue: number;
  taxValue: number;
}

export interface EmporixApprovalDeliveryWindow {
  id: string;
  slotId: string;
  deliveryDate: string;
}

export interface EmporixApprovalResourceItem {
  quantity: number;
  itemPrice: EmporixApprovalPrice;
  itemYrn: string;
}

export interface EmporixApprovalResource {
  id: string;
  items?: EmporixApprovalResourceItem[];
  totalPrice?: EmporixApprovalPrice;
  subTotalPrice?: EmporixApprovalPrice;
  subtotalAggregate?: EmporixApprovalTaxablePrice;
  amount?: number;
  siteCode?: string;
  deliveryWindow?: EmporixApprovalDeliveryWindow;
}

export interface EmporixApprovalPayment {
  paymentId: string;
  customAttributes?: Record<string, any>;
}

export interface EmporixApprovalDetails {
  currency: string;
  paymentMethods?: EmporixCheckoutPaymentMethod[];
  shipping?: EmporixShipping;
  payment?: EmporixApprovalPayment;
  addresses?: EmporixCheckoutAddress[];
}

export type EmporixApprovalResourceType = 'CART';
export type EmporixApprovalAction = 'CHECKOUT';
export type EmporixApprovalStatus = 'PENDING' | 'APPROVED' | 'CLOSED' | 'EXPIRED' | 'DECLINED';

export interface EmporixApprovalBase {
  resourceType: EmporixApprovalResourceType;
  action: EmporixApprovalAction;
  approver: {
    userId: string;
  };
  comment?: string;
  details?: EmporixApprovalDetails;
}

export interface EmporixApprovalCreateRequest extends EmporixApprovalBase {
  id?: string;
  resourceId: string;
}

export interface EmporixApprovalResponse extends EmporixApprovalBase {
  id: string;
  approverComment?: string;
  resource: EmporixApprovalResource;
  requestor: EmporixApprovalRequestor;
  approver: EmporixApprovalUser;
  status: EmporixApprovalStatus;
  expiryDate?: string;
  metadata: Metadata;
}

export interface EmporixApprovalId {
  id: string;
}

export interface EmporixApprovalPermittedRequest {
  resourceType: EmporixApprovalResourceType;
  resourceId: string;
  action: EmporixApprovalAction;
}

export interface EmporixApprovalPermittedResponse {
  action: EmporixApprovalAction;
  status?: EmporixApprovalStatus;
  permitted: boolean;
  approvalId?: string;
}

export interface EmporixApprovalSearchUsersRequest {
  resourceType: EmporixApprovalResourceType;
  resourceId: string;
  action: EmporixApprovalAction;
}

export type EmporixApprovalUpdateOperation = 'add' | 'remove' | 'replace';
export type EmporixApprovalUpdatePath =
  | '/status'
  | '/details'
  | '/comment'
  | '/approverComment'
  | '/resource/deliveryWindow';

export interface EmporixApprovalUpdateRequest {
  op: EmporixApprovalUpdateOperation;
  path: EmporixApprovalUpdatePath | string;
  value: EmporixApprovalStatus | string | Record<string, any>;
}
