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
  orderId?: string;
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
  /**
   * Goods-only net from Emporix `subtotalPrice.netValue` when present.
   * Prefer for Quoted Price “Net value of goods”; `totalNet` may include shipping.
   */
  subtotalNet?: number;
  /** Goods-only tax from Emporix `subtotalPrice.taxValue`. */
  subtotalVat?: number;
  /** Single taxAggregate rate when present; display VAT % uses item `taxRate` instead. */
  vatRate?: number;
  /** Shipping VAT % from Emporix `shipping.taxRate` (independent of goods item rates). */
  shippingTaxRate?: number;
  /** Full VAT breakdown from Emporix. Goods VAT % is taken from item `taxRate` values, not this aggregate. */
  taxAggregate?: {
    lines: Array<{
      name: string;
      amount: number;
      rate: number;
      taxable: number;
    }>;
  };
  items: QuoteItem[];
  cartId?: string;
  shippingAddress: CheckoutAddress;
  shippingCost: number;
  /** Emporix `shipping.grossValue` — used with shippingCost for shipping tax. */
  shippingGross?: number;
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
  itemPrice: QuoteItemPrice;
  id: string;
  name?: string | LocalizedString;
}

export interface QuoteItemPrice {
  amount: number;
  currency: string;
  baseAmount?: number;
  tax?: number;
  grossValue?: number;
  netValue?: number;
  /** Original net unit price before quote discount (`unitPrice` from API). */
  unitPrice?: number;
  /** Discounted net unit price (`newUnitPrice` from API). */
  newUnitPrice?: number;
  /** Discount percentage (e.g. 35 for 35%). */
  discount?: number;
  /** Item tax rate percent from `price.tax.taxRate`. */
  taxRate?: number;
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
  | 'AWAITING'
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
  userType?: QuoteUserType;
  comment: string;
  modifiedAt: string;
  rawModifiedAt?: string;
  fieldChanged: string;
  statusValue?: string;
  quoteReason?: string;
}

export type QuoteHistory = QuoteHistoryItem[];

export interface UseQuoteHistoryResult {
  history: QuoteHistory;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}
