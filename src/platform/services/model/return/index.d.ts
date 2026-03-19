/**
 * Service layer models for return functionality
 */
import { Price } from '../common';

/**
 * Return approval status
 */
export type ReturnStatus = 'APPROVED' | 'PENDING' | 'REJECTED' | 'REVIEWED' | 'CLOSED';

/**
 * Reason for return (at return or item level)
 */
export interface ReturnReason {
  code?: string;
  details?: string;
}

/**
 * Price for return items
 */
export interface ReturnPrice {
  value: number;
  currency: string;
  formattedValue?: string;
}

export interface ReturnCalculatedValue {
  netValue: number;
  grossValue: number;
  taxValue: number;
  taxCode?: string;
  taxRate?: number;
  valid?: boolean;
  currency?: string;
}

export interface ReturnCalculatedPrice {
  finalPrice: ReturnCalculatedValue;
}

/**
 * Individual item within a return order
 */
export interface ReturnItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: ReturnPrice;
  grossUnitPrice?: ReturnPrice;
  total?: ReturnPrice;
  calculatedUnitPrice?: ReturnCalculatedValue;
  calculatedPrice?: ReturnCalculatedPrice;
  reason?: ReturnReason;
  productId?: string;
  images?: string[];
  brand?: string;
  vendorName?: string;
  itemNumber?: string;
  netPrice?: ReturnPrice;
}

/**
 * Order containing items to be returned
 */
export interface ReturnOrder {
  id: string;
  items: ReturnItem[];
}

/**
 * Requestor information (who requested the return)
 */
export interface ReturnRequestor {
  customerId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  anonymous?: boolean;
  fullName?: string;
}

export interface ReturnSubmitter {
  userType?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface ReturnAssistedBuyingEntry {
  employeeId: string;
  operation: 'CREATE' | 'UPDATE_STATUS';
  timestamp: string;
}

export interface ReturnMetadata {
  createdAt?: string;
  modifiedAt?: string;
  calculatedAt?: string;
  version?: number;
  mixins?: {
    [key: string]: string;
  };
  [key: string]: string | number | object | Array<unknown> | null | undefined;
}

/**
 * Main return entity
 */
export interface Return {
  id: string;
  status: ReturnStatus;
  approvalStatus?: ReturnStatus;
  received: boolean;
  expiryDate?: string;
  isExpired: boolean;
  total?: ReturnPrice;
  calculatedPrice?: ReturnCalculatedPrice;
  reason?: ReturnReason;
  orders: ReturnOrder[];
  requestor?: ReturnRequestor;
  submitter?: ReturnSubmitter;
  entries?: ReturnAssistedBuyingEntry[];
  metadata?: ReturnMetadata;
  mixins?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Summary for returns list display
 */
export interface ReturnSummary {
  id: string;
  status: ReturnStatus;
  isExpired: boolean;
  total?: ReturnPrice;
  orderIds: string[];
  itemCount: number;
  createdAt?: string;
}
