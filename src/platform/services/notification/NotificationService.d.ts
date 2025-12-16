import { StorefrontNotification } from './model/notification/notification';
import { StorefrontNotificationSubscription } from './model/notification/notification';

/**
 * Service for managing storefront notifications
 */
export interface NotificationService {
  /**
   * Get all notifications for the current context (session, customer, company, cart)
   * @returns Promise with array of notifications from all relevant contexts
   */
  getAllContextNotifications(): Promise<StorefrontNotification[]>;
  /**
   * Get all notifications for the current session
   * @returns Promise with array of notifications
   */
  getSessionNotifications(): Promise<StorefrontNotification[]>;

  /**
   * Get all notifications for a specific customer
   * @returns Promise with array of notifications
   */
  getCustomerNotifications(): Promise<StorefrontNotification[]>;

  /**
   * Get all notifications for a specific company (legal entity)
   * @returns Promise with array of notifications
   */
  getCompanyNotifications(): Promise<StorefrontNotification[]>;

  /**
   * Get all notifications for a specific cart
   * @returns Promise with array of notifications
   */
  getCartNotifications(): Promise<StorefrontNotification[]>;

  /**
   * Get a notification by ID
   * @param notificationId Notification ID
   * @returns Promise with the notification details
   */
  getNotification(notificationId: string): Promise<StorefrontNotification>;

  /**
   * Delete a notification
   * @param notificationId Notification ID
   * @returns Promise resolving when deletion is complete
   */
  deleteNotification(notificationId: string): Promise<void>;

  /**
   * Subscribe to push notifications
   * @param subscription Push notification subscription data
   * @returns Promise resolving when subscription is complete
   */
  subscribe(subscription: WebPushSubscriptionRegistration): Promise<string>;

  /**
   * Unsubscribe from push notifications
   * @param subscriptionId Subscription ID
   * @returns Promise resolving when unsubscription is complete
   */
  unsubscribe(subscriptionId: string): Promise<void>;

  /**
   * Send push notification to all subscriptions for a notification
   * @param notificationId Notification ID
   * @returns Promise resolving when push notifications are sent
   */
  sendPushNotification(notificationId: string): Promise<void>;
}
