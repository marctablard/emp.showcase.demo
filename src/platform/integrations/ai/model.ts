/**
 * AI Chat Context interface
 * Contains context information for AI chat requests
 */
export interface AIChatContext {
  cartId?: string;
  siteId: string;
  currency: string;
  language: string;
  sessionId?: string;
}

/**
 * AI Chat Request interface
 * Contains the request data for AI chat
 */
export interface AIChatRequest {
  agentId: string;
  message: string;
}

/**
 * AI Chat Response interface
 * Contains the response data from AI chat
 */
export interface AIChatResponse {
  agentId: string;
  agentType: string;
  message: string;
  sessionId: string;
}

/**
 * AI Parsed Message interface
 * Contains structured data from AI responses
 */
export interface AIParsedMessage {
  agentId: string;
  sessionId: string;
  message: string;
  type: string;
  data: any;
  timestamp: string;
}

/**
 * AI Cart Summary Data interface
 * Contains structured cart summary data from AI responses
 */
export interface AICartSummaryData {
  totalItems: number;
  shops: Array<{
    shopId: string;
    shopName: string;
    shopLogo: string | null;
    items: Array<{
      productId: string;
      name: string;
      image: string;
      quantity: number;
      price: number;
      currency: string;
    }>;
    subtotal: number;
    currency: string;
  }>;
  grandTotal: number;
  currency: string;
}
