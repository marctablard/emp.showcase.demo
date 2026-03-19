/**
 * Models for the Emporix Returns API
 * Based on: https://developer.emporix.io/api-references/api-guides/orders/returns/api-reference/returns
 */
import { EmporixMetadata } from './common';

/**
 * Return approval status
 */
export type EmporixReturnStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'CLOSED' | 'REVIEWED';

/**
 * Price object with value and currency
 */
export interface EmporixReturnPrice {
  value: number;
  currency: string;
}

export interface EmporixReturnCalculatedValue {
  netValue: number;
  grossValue: number;
  taxValue: number;
  taxCode?: string;
  taxRate?: number;
  valid?: boolean;
  currency?: string;
}

export interface EmporixReturnCalculatedPrice {
  finalPrice: EmporixReturnCalculatedValue;
}

/**
 * Reason for return (at return or item level)
 */
export interface EmporixReturnReason {
  code?: string;
  details?: string;
}

/**
 * Individual item within a return order
 */
export interface EmporixReturnOrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: EmporixReturnPrice;
  total?: EmporixReturnPrice;
  calculatedUnitPrice?: EmporixReturnCalculatedValue;
  calculatedPrice?: EmporixReturnCalculatedPrice;
  reason?: EmporixReturnReason;
}

/**
 * Order containing items to be returned
 */
export interface EmporixReturnOrder {
  id: string;
  items?: EmporixReturnOrderItem[];
}

/**
 * Requestor information (who requested the return)
 */
export interface EmporixReturnRequestor {
  customerId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  anonymous?: boolean;
}

/**
 * Submitter information (who submitted the return)
 */
export interface EmporixReturnSubmitter {
  userType?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

/**
 * Assisted buying entry for tracking employee actions
 */
export interface EmporixReturnAssistedBuyingEntry {
  employeeId: string;
  operation: 'CREATE' | 'UPDATE_STATUS';
  timestamp: string;
}

/**
 * Full return response from the API (fullCustomerReturn schema)
 */
export interface EmporixReturnResponse {
  id: string;
  approvalStatus: EmporixReturnStatus;
  received?: boolean;
  expiryDate?: string;
  total?: EmporixReturnPrice;
  calculatedPrice?: EmporixReturnCalculatedPrice;
  reason?: EmporixReturnReason;
  orders?: EmporixReturnOrder[];
  metadata?: EmporixMetadata;
  mixins?: Record<string, unknown>;
  // Employee-visible fields (may not be present for customer requests)
  requestor?: EmporixReturnRequestor;
  submitter?: EmporixReturnSubmitter;
  entries?: EmporixReturnAssistedBuyingEntry[];
}

/**
 * Request body for creating a return (customer-created)
 */
export interface EmporixReturnCreateRequest {
  orders: Array<{
    id: string;
    items: Array<{
      id: string;
      quantity: number;
      reason?: EmporixReturnReason;
    }>;
  }>;
  reason: EmporixReturnReason;
  mixins?: Record<string, unknown>;
  metadata?: {
    mixins?: Record<string, string>;
  };
}

/**
 * Response when creating a return
 */
export interface EmporixReturnId {
  id: string;
}
