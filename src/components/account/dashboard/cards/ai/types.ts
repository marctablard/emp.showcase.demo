/**
 * AI Assistant Types
 * All type definitions for the AI chat feature
 */

// ============================================================================
// Price Types
// ============================================================================

export interface PriceData {
  value?: number;
  net?: number;
  netValue?: number;
  gross?: number;
  grossValue?: number;
  tax?: number;
  taxValue?: number;
  finalNetValue?: number;
  finalGrossValue?: number;
  finalTaxValue?: number;
  currency?: string;
}

export interface NormalizedPrice {
  net: number;
  gross: number;
  tax: number;
}

// ============================================================================
// Common Types
// ============================================================================

export interface AddressData {
  name: string;
  company?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  tags?: string[];
}

export interface PaginationData {
  page: number;
  totalPages: number;
  totalItems: number;
}

export interface PaymentData {
  method: string;
  status: string;
}

// ============================================================================
// Table & Misc Types
// ============================================================================

export interface TableData {
  title?: string;
  headers: string[];
  rows: string[][];
  columnTypes?: string[];
}

export interface HTMLData {
  html: string;
}

export interface ErrorData {
  errorCode?: string;
  message: string;
  details?: string;
  canRetry?: boolean;
}

export interface AddressListData {
  addresses: AddressData[];
  message?: string;
}

// ============================================================================
// Product Types
// ============================================================================

export interface ProductData {
  productId: string;
  name: string;
  image?: string;
  brand?: string;
  description?: string;
  price?: string | number;
  originalPrice?: string | number;
  currency?: string;
  rating?: number;
  reviewCount?: number;
}

export interface ProductListData {
  products: ProductData[];
  context?: string;
}

export interface ProductSelectionItemData {
  itemId: string;
  name: string;
  image?: string;
  description?: string;
  price?: string | number;
  currency?: string;
  attributes?: Record<string, unknown>;
}

export interface VariantGroupData {
  message: string;
  description?: string;
  items?: ProductSelectionItemData[];
}

export interface ProductSelectionData {
  message?: string;
  variantGroups?: VariantGroupData[];
  instructions?: string;
}

// ============================================================================
// Account Types
// ============================================================================

export interface PersonalInfoData {
  name: string;
  email: string;
  company?: string;
  customerNumber?: string;
  businessModel?: string;
  preferredLanguage?: string;
  preferredCurrency?: string;
  preferredSite?: string;
  lastLogin?: string;
}

export interface AccountDetailsData {
  personalInfo?: PersonalInfoData;
  addresses?: AddressData[];
}

// ============================================================================
// Cart Types
// ============================================================================

export interface CartItemData {
  productId: string;
  name: string;
  image?: string;
  description?: string;
  quantity: number;
  price?: number;
  currency?: string;
  unitPrice?: PriceData;
  totalPrice?: PriceData;
  unitNetValue?: number;
  unitGrossValue?: number;
}

export interface ShopData {
  shopName: string;
  subtotal?: number;
  currency?: string;
  items?: CartItemData[];
}

export interface CartSummaryData {
  total?: PriceData;
  subtotal?: PriceData;
  items?: CartItemData[];
  currency?: string;
  siteCode?: string;
  shops?: ShopData[];
}

// ============================================================================
// Order Types
// ============================================================================

export interface OrderItemData {
  productId?: string;
  name: string;
  image?: string;
  description?: string;
  quantity: number;
  unitPrice?: PriceData;
  totalPrice?: PriceData;
}

export interface OrderData {
  orderId: string;
  status: string;
  date: string;
  totalItems?: number;
  itemCount?: number;
  total?: PriceData;
  currency?: string;
  siteCode?: string;
  items?: OrderItemData[];
}

export interface OrderListData {
  orders: OrderData[];
  pagination?: PaginationData;
}

export interface OrderSummaryData extends OrderData {
  subtotal?: PriceData;
  shipping?: PriceData;
  shippingAddress?: AddressData;
  billingAddress?: AddressData;
  payment?: PaymentData;
}

// ============================================================================
// Quote Types
// ============================================================================

export interface QuoteItemData {
  productId?: string;
  name: string;
  image?: string;
  description?: string;
  quantity: number;
  price?: number;
  currency?: string;
  unitPrice?: PriceData;
  totalPrice?: PriceData;
}

export interface QuotePreviewItemData {
  name: string;
  image?: string;
  quantity: number;
}

export interface QuoteData {
  quoteId: string;
  reference?: string;
  status: string;
  submittedDate: string;
  validTo?: string;
  totalGross?: number;
  totalNet?: number;
  totalVat?: number;
  currency?: string;
  itemCount?: number;
  customerName?: string;
  previewItems?: QuotePreviewItemData[];
}

export interface QuoteListData {
  quotes: QuoteData[];
  message?: string;
  pagination?: PaginationData;
}

export interface QuoteDetailsData extends QuoteData {
  message?: string;
  items?: QuoteItemData[];
  shippingAddress?: AddressData;
  shippingCost?: number;
  shippingMethod?: string;
  userComment?: string;
  employeeComment?: string;
  approverName?: string;
}

// ============================================================================
// Return Types
// ============================================================================

export interface ReturnReasonData {
  code: string;
  details?: string;
}

export interface ReturnItemData {
  name: string;
  image?: string;
  quantity: number;
  total?: PriceData;
  unitPrice?: PriceData;
  reason?: ReturnReasonData;
}

export interface ReturnOrderData {
  id: string;
  items?: ReturnItemData[];
}

export interface ReturnData {
  id: string;
  approvalStatus: string;
  received?: boolean;
  expiryDate?: string;
  total?: PriceData;
  currency?: string;
  reason?: ReturnReasonData;
  orders?: ReturnOrderData[];
}

export interface ReturnListData {
  returns: ReturnData[];
  message?: string;
}

export interface ReturnDetailsData {
  return?: ReturnData;
  returns?: ReturnData[];
  message?: string;
}

// ============================================================================
// Structured Data Types
// ============================================================================

export type StructuredDataType =
  | 'cart_summary'
  | 'account_details'
  | 'order_list'
  | 'order_summary'
  | 'product_list'
  | 'product_selection'
  | 'address_list'
  | 'quote_list'
  | 'quote_details'
  | 'return_list'
  | 'return_details'
  | 'table'
  | 'html'
  | 'text'
  | 'error';

export type StructuredData =
  | { type: 'cart_summary'; data: CartSummaryData }
  | { type: 'account_details'; data: AccountDetailsData }
  | { type: 'order_list'; data: OrderListData }
  | { type: 'order_summary'; data: OrderSummaryData }
  | { type: 'product_list'; data: ProductListData }
  | { type: 'product_selection'; data: ProductSelectionData }
  | { type: 'address_list'; data: AddressListData }
  | { type: 'quote_list'; data: QuoteListData }
  | { type: 'quote_details'; data: QuoteDetailsData }
  | { type: 'return_list'; data: ReturnListData }
  | { type: 'return_details'; data: ReturnDetailsData }
  | { type: 'table'; data: TableData }
  | { type: 'html'; data: HTMLData }
  | { type: 'error'; data: ErrorData }
  | { type: 'text'; data: null };

export type StructuredDataPayload<T extends StructuredDataType> = Extract<StructuredData, { type: T }>['data'];

// ============================================================================
// Chat & Form Types
// ============================================================================

export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  data?: unknown;
  type?: string;
}

export interface AiHelperFormData {
  question: string;
}

export interface StructuredDataHandlers {
  setQuestionValue: (question: string) => void;
  handleQuestionSubmit: (data: AiHelperFormData) => void;
}

// ============================================================================
// Type Aliases (for backwards compatibility)
// ============================================================================

export type Product = ProductData;
export type ProductSelectionItem = ProductSelectionItemData;
