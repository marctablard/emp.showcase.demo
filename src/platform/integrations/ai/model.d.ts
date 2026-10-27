export interface AIChatRequest {
  agentId: string;
  message: string;
}

export interface AIChatResponse {
  agentId: string;
  agentType: string;
  message: string;
  sessionId: string;
  cartRefresh?: boolean;
}

export interface AIChatContext {
  cartId?: string;
  siteId: string;
  currency: string;
  language: string;
  sessionId?: string;
  subscriptions?: AIChatSubscriptions;
}

export interface AIChatSubscriptions {
  scope: 'mine' | 'company';
  note: string;
  items: {
    id: string;
    status: string;
    owner?: string;
    renewEvery: string;
    scheduleLocked: boolean;
    nextOrderDate?: string;
    lastOrderDate?: string;
    endDate?: string;
    products: { productId: string; name?: string; quantity: number }[];
    orderIds: string[];
    link: string;
  }[];
}

export interface AIParsedMessage {
  agentId: string;
  sessionId: string;
  message: string;
  type: string;
  data: any;
  timestamp: string;
  cartRefresh?: boolean;
}
