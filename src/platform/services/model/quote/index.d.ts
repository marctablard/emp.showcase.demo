import { EmporixAddress } from '@/platform/integrations/emporix/model';
import { EmporixMetadata } from '@/platform/integrations/emporix/model/common';
import type { EmporixCreateQuoteRequest } from '@/platform/integrations/emporix/model/quote';
import { CheckoutAddress } from '../checkout';
import { LocalizedString } from '../common';

/**
 * Quote entity for the application
 */
export interface Quote {
  id: string;
  reference?: string;
  status: QuoteStatus;
  submittedDate: string;
  customerId: string;
  customerName?: string;
  employeeComment?: string;
  approverId?: string;
  approverName?: string;
  currency: string;
  totalGross: number;
  totalNet: number;
  totalVat: number;
  items: QuoteItem[];
  cartId?: string;
  shippingAddress: CheckoutAddress;
  shippingCost: number;
  shippingMethod: string;
  userComment?: string;
}

export interface QuoteShipping {
  value?: number;
  grossValue?: number;
  methodId?: string;
  zoneId?: string;
  methodName?: {
    [key: string]: string;
  };
  shippingTaxCode?: string;
}

/**
 * Quote item
 */
export interface QuoteItem {
  product: QuoteItemProduct;
  quantity: {
    quantity: number;
    unitCode: string;
  };
}

export interface QuoteItemProduct {
  quantity: number;
  itemPrice: ApprovalPrice;
  id: string;
  name?: string | LocalizedString;
}

export type CreateQuoteInput = EmporixCreateQuoteRequest;

export interface QuoteReason {
  id: string;
  code: string;
  message: LocalizedString;
  type: string;
  metadata: EmporixMetadata;
}

export interface QuoteReasonCreationResponse {
  id: string;
}

export type QuoteScope = 'public' | 'session' | 'customer-saas' | 'service';

export type QuoteStatus =
  | 'CREATING'
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'DECLINED'
  | 'ACCEPTED'
  | 'ORDER_CREATED'
  | 'CLOSED'
  | 'CHANGE'
  | 'DECLINE'
  | 'DECLINED_BY_MERCHANT'
  | 'EXPIRED';

export type QuoteUpdateOperation = 'ADD' | 'REMOVE' | 'REPLACE' | 'CREATE';

export type QuoteUpdatePath =
  | '/quote'
  | '/status'
  | '/validTo'
  | '/comment'
  | '/billingAddressId'
  | '/shippingAddressId'
  | '/companyName'
  | '/customerId'
  | '/shipping'
  | '/items'
  | '/items/{itemId}'
  | '/items/{itemId}/price'
  | '/mixins/{mixinsPath}'
  | '/metadata/{mixinsPath}';

export type QuoteUserType = 'EMPLOYEE' | 'CUSTOMER' | 'SYSTEM';

export interface QuoteUpdateValues {
  [key: string]: any;
}

export interface QuoteUpdateRequest {
  op: QuoteUpdateOperation;
  path: QuoteUpdatePath | string;
  value: QuoteStatus | string | Record<string, any>;
}

export interface QuoteHistoryItem {
  id: string;
  userFullName: string;
  comment: string;
  modifiedAt: string;
  rawModifiedAt?: string;
  fieldChanged: string;
}

export type QuoteHistory = QuoteHistoryItem[];

export interface UseQuoteHistoryResult {
  history: QuoteHistory;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
