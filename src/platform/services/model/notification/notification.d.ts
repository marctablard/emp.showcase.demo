/**
 * Notification type enum
 */
export type NotificationType = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR';

/**
 * Reference type enum for entities that notifications can refer to
 */
export type ReferenceType = 'CART' | 'CUSTOMER' | 'COMPANY';

/**
 * Recipient type enum for notification recipients
 */
export type RecipientType = 'SESSION' | 'CART_OWNER' | 'CUSTOMER' | 'COMPANY';

/**
 * Interface representing a notification
 */
export interface StorefrontNotification<T = any> {
  /**
   * Unique identifier for the notification
   */
  id: string;

  /**
   * Code of the notification
   */
  code?: string;

  /**
   * Type of notification (INFO, SUCCESS, WARN, ERROR)
   */
  type: NotificationType;

  /**
   * Type of entity this notification refers to (optional)
   */
  reference_type?: ReferenceType;

  /**
   * ID of the referenced entity (optional)
   */
  reference_id?: string;

  /**
   * ID of the recipient (optional)
   */
  recipient_id?: string;

  /**
   * Type of the recipient
   */
  recipient_type: RecipientType;

  /**
   * Notification message (can be localized)
   */
  message?: LocalizedString;

  /**
   * Additional data for the notification (JSON string)
   */
  data_json?: T;

  /**
   * Creation timestamp
   */
  created?: string;

  /**
   * Last update timestamp
   */
  updated?: string;
}

export interface WebPushSubscriptionRegistration {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface StorefrontNotificationSubscription extends WebPushSubscriptionRegistration {
  id: string;
  origin: string;
  recipient: {
    sessionId: string;
    customerId?: string;
  };
}

/**
 * Interface for notification action
 */
export interface NotificationAction {
  /**
   * Action identifier
   */
  action: string;

  /**
   * Display title for the action
   */
  title: string;

  /**
   * URL to navigate to when action is clicked
   */
  url?: string;

  /**
   * Icon to display for the action
   */
  icon?: string;
}

/**
 * Interface for augmented notification payload
 */
export interface NotificationPayload {
  /**
   * Notification title
   */
  title: string;

  /**
   * Notification body text
   */
  body: string;

  /**
   * Notification ID
   */
  id: string;

  /**
   * Additional data for the notification
   */
  data?: any;

  /**
   * Icon URL for the notification
   */
  icon?: string;

  /**
   * Badge URL for the notification
   */
  badge?: string;

  /**
   * Image URL for the notification
   */
  image?: string;

  /**
   * URL to navigate to when notification is clicked
   */
  url?: string;

  /**
   * Whether the notification requires interaction to dismiss
   */
  requireInteraction?: boolean;

  /**
   * Actions available for the notification
   */
  actions?: NotificationAction[];
}
