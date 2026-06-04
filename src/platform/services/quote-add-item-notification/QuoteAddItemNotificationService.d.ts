import type { QuoteAddItemNotification } from '@/platform/services/model/quote-add-item-notification/quote-add-item-notification';

export interface QuoteAddItemNotificationService {
  getNotification(notificationId: string): Promise<QuoteAddItemNotification | null>;
}
