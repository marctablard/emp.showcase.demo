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

export interface EmporixAIParsedMessage {
  agentId: string;
  sessionId: string;
  message: string;
  type: string;
  data: any;
  timestamp: string;
}
