export interface ChatMessage {
  id: string;
  content: string;
  isUser: boolean;
  timestamp: Date;
  data?: any;
  type?: string;
}

export type AiHelperFormData = {
  question: string;
};

export interface Product {
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

export interface ProductSelectionItem {
  itemId: string;
  name: string;
  image?: string;
  description?: string;
  price?: string | number;
  currency?: string;
  attributes?: Record<string, any>;
}

export interface StructuredDataHandlers {
  setQuestionValue: (question: string) => void;
  handleQuestionSubmit: (data: AiHelperFormData) => void;
}
