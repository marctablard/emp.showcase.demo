import { getTranslations } from 'next-intl/server';
import { type NotificationCodeKey, dk } from '@/i18n/dynamic-key';
import { injectable } from '@/platform/core/di/injectable';
import type { NotificationPayload, StorefrontNotification } from '@/platform/services/model/notification/notification';
import type { NotificationPayloadService } from '../NotificationPayloadService';

/**
 * Default implementation of NotificationPayloadService
 * Enriches notifications with additional context and actions
 */
@injectable('NotificationPayloadService', 'Singleton')
export class DefaultNotificationPayloadServiceServer implements NotificationPayloadService {
  /**
   * Augment a notification with additional context and actions
   * @param notification The notification to augment
   * @param locale The locale to use for translations
   * @returns Augmented notification payload
   */
  async createPayload(notification: StorefrontNotification, locale: string): Promise<NotificationPayload> {
    // Get translations for notification content
    const t = await getTranslations({ locale, namespace: 'notifications' });

    // Create base notification payload
    const payload: NotificationPayload = {
      id: notification.id,
      title:
        notification.code && notification.code.trim() !== ''
          ? t(dk<NotificationCodeKey>(notification.code))
          : 'Notification',
      body: notification.message && notification.message[locale] ? notification.message[locale] : '',
      data: notification.data_json,
      icon: '/images/logo_small.svg',
      requireInteraction: true,
    };

    // Add notification-specific augmentations based on notification code
    switch (notification.code) {
      case 'SUBSTITUTION_AVAILABLE':
      case 'ITEM_PRICE_CHANGE':
        return this.addCartNotificationActions(payload, t);
      default:
        return payload;
    }
  }

  /**
   * Augment a substitution notification with cart action
   * @param payload Base notification payload
   * @param t Translation function
   * @returns Augmented notification payload
   */
  private addCartNotificationActions(payload: NotificationPayload, t: any): NotificationPayload {
    // Add "Go To Cart" action
    return {
      ...payload,
      url: '/cart', // Default URL when clicking the notification
      actions: [
        {
          action: 'go-to-cart',
          title: t('actions.goToCart'),
        },
      ],
    };
  }
}

export default DefaultNotificationPayloadServiceServer;
