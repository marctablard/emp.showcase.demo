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
