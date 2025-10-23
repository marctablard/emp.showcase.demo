import { EmporixMetadata, EmporixMixins } from './common';

export interface EmporixAIChatRequest {
  agentId: string;
  message: string; // JSON stringified AIUserMessage
}

export interface EmporixAIChatResponse {
  agentId: string;
  agentType: string;
  message: string; // JSON stringified AIParsedMessage
  sessionId: string;
}

export interface EmporixAIChatContext {
  cartId?: string;
  siteId: string;
  currency: string;
  language: string;
  sessionId?: string;
}

export interface EmporixAIUserMessage {
  userMessage: string;
  context: EmporixAIChatContext;
}

export interface EmporixAICartSummaryData {
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

export interface EmporixAIParsedMessage {
  agentId: string;
  sessionId: string;
  message: string;
  type: string;
  data: EmporixAICartSummaryData;
  timestamp: string;
}
