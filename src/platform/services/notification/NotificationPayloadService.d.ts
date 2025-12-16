import { NotificationPayload, StorefrontNotification } from '../model/notification/notification';

/**
 * Service for augmenting notifications with additional context and actions
 */
export interface NotificationPayloadService {
  /**
   * Augment a notification with additional context and actions
   * @param notification The notification to augment
   * @param locale The locale to use for translations
   * @returns Augmented notification payload
   */
  createPayload(notification: StorefrontNotification, locale: string): Promise<NotificationPayload>;
}
