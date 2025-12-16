import { inject } from 'inversify';
import webpush from 'web-push';
import { baseUrl } from '@/lib/utils';
import { injectable } from '@/platform/core/di/injectable';
import { EmporixPaginatedResponse } from '@/platform/integrations/emporix/model';
import { EmporixCustomEntity } from '@/platform/integrations/emporix/model/schema';
import type { EmporixSchemaApi } from '@/platform/integrations/emporix/schema/EmporixSchemaApi';
import type { CartService } from '@/platform/services/cart/CartService';
import type { CustomerService } from '@/platform/services/customer/CustomerService';
import type {
  RecipientType,
  StorefrontNotification,
  StorefrontNotificationSubscription,
  WebPushSubscriptionRegistration,
} from '@/platform/services/model/notification/notification';
import type { SessionService } from '@/platform/services/session/SessionService';
import type { NotificationPayloadService } from '../NotificationPayloadService';
import type { NotificationService as INotificationService } from '../NotificationService';

/**
 * Implementation of the NotificationService for managing storefront notifications
 */
@injectable('NotificationService', 'Singleton')
export class EmporixNotificationServiceServer implements INotificationService {
  private readonly NOTIFICATION_TYPE = 'STOREFRONT_NOTIFICATION';
  private readonly SUBSCRIPTION_TYPE = 'STOREFRONT_PUSH_SUBSCRIPTION';

  constructor(
    @inject('EmporixSchemaApi') private schemaApi: EmporixSchemaApi,
    @inject('SessionService') private sessionService: SessionService,
    @inject('CustomerService') private customerService: CustomerService,
    @inject('NotificationPayloadService') private augmentationService: NotificationPayloadService,
    @inject('CartService') private cartService: CartService,
  ) {
    // Configure web-push with VAPID details
    if (process.env.VAPID_CONTACT && process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(
        process.env.VAPID_CONTACT, // Replace with your contact email
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY,
      );
    }
  }

  /**
   * Get all notifications for the current context (session, customer, company, cart)
   */
  async getAllContextNotifications(): Promise<StorefrontNotification[]> {
    try {
      // Get the current session
      const session = await this.sessionService.getCurrent();
      if (!session) {
        throw new Error('No active session found');
      }

      // Initialize notifications array
      let notifications: StorefrontNotification[] = [];

      // Get session notifications
      const sessionId = session.id;
      if (sessionId) {
        const sessionNotifications = await this.getNotificationsByRecipient('SESSION', sessionId);
        notifications = [...notifications, ...sessionNotifications];
      }

      // Get cart notifications if cart ID is available
      if (session.cartId) {
        const cartNotifications = await this.getNotificationsByRecipient('CART_OWNER', session.cartId);
        notifications = [...notifications, ...cartNotifications];
      }

      // Get customer notifications if customer is logged in
      if (session?.customerId) {
        const customerNotifications = await this.getNotificationsByRecipient('CUSTOMER', session.customerId);
        notifications = [...notifications, ...customerNotifications];
        // TODO store legalEntities on Session for performance!
        const customer = await this.customerService.getCustomer();
        // If customer belongs to a company, get company notifications
        if (customer?.legalEntityId) {
          const companyNotifications = await this.getNotificationsByRecipient('COMPANY', customer.legalEntityId);
          notifications = [...notifications, ...companyNotifications];
        }
      }

      // Remove duplicates if any (based on notification ID)
      const uniqueNotifications = Array.from(
        new Map(notifications.map((notification) => [notification.id, notification])).values(),
      );

      // Sort by creation date (newest first)
      return uniqueNotifications.sort((a, b) => {
        const dateA = new Date(a.created || 0).getTime();
        const dateB = new Date(b.created || 0).getTime();
        return dateB - dateA;
      });
    } catch (_error) {
      console.warn('Failed to get context notifications, most likely a call that happened during Logout');
      return [];
    }
  }

  /**
   * Get all notifications for the current session
   */
  async getSessionNotifications(): Promise<StorefrontNotification[]> {
    const session = await this.sessionService.getCurrent();
    if (!session) {
      throw new Error('No active session found');
    }
    return this.getNotificationsByRecipient('SESSION', session.id);
  }

  /**
   * Get all notifications for a specific customer
   */
  async getCustomerNotifications(): Promise<StorefrontNotification[]> {
    const customer = await this.customerService.getCustomer();
    if (customer?.id) {
      return this.getNotificationsByRecipient('CUSTOMER', customer.id);
    }
    return [];
  }

  /**
   * Get all notifications for a specific company (legal entity)
   */
  async getCompanyNotifications(): Promise<StorefrontNotification[]> {
    const customer = await this.customerService.getCustomer();
    if (customer?.legalEntityId) {
      return this.getNotificationsByRecipient('COMPANY', customer.legalEntityId);
    }
    return [];
  }

  /**
   * Get all notifications for a specific cart
   */
  async getCartNotifications(): Promise<StorefrontNotification[]> {
    const session = await this.sessionService.getCurrent();
    if (session?.cartId) {
      return this.getNotificationsByRecipient('CART_OWNER', session.cartId);
    }
    return [];
  }

  /**
   * Get a notification by ID
   */
  async getNotification(notificationId: string): Promise<StorefrontNotification | null> {
    try {
      const response = await this.schemaApi.getCustomEntity(this.NOTIFICATION_TYPE, notificationId);
      if (!response) {
        console.warn(`Notification ${notificationId} not found`);
        return null;
      }
      return this.mapNotificationToService(response);
    } catch (error) {
      console.error(`Failed to get notification ${notificationId}:`, error);
      throw new Error(`Failed to get notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Delete a notification
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      await this.schemaApi.deleteCustomEntity(this.NOTIFICATION_TYPE, notificationId);
    } catch (error) {
      console.error(`Failed to delete notification ${notificationId}:`, error);
      throw new Error(`Failed to delete notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async subscribe(subscription: WebPushSubscriptionRegistration): Promise<string> {
    try {
      const session = await this.sessionService.getCurrent();
      if (!session) {
        throw new Error('No active session found');
      }
      if (!subscription.keys || !subscription.endpoint) {
        throw new Error('Invalid subscription data');
      }
      const existingSubscription = await this.schemaApi.searchCustomEntities(this.SUBSCRIPTION_TYPE, {
        criteria: {
          'mixins.PUSH_SUBSCRIPTION_DATA.p256dh_key': subscription.keys.p256dh,
          'mixins.PUSH_SUBSCRIPTION_DATA.endpoint': subscription.endpoint,
          'mixins.PUSH_SUBSCRIPTION_DATA.origin': baseUrl,
        },
      });
      let subscriptionId: string | undefined;
      if (existingSubscription.items.length > 0) {
        existingSubscription.items.forEach((item) => {
          if (!item.id) {
            throw new Error(`Subscription ${item.id} does not have an id`);
          }
          // Look if there's already a matching subscription
          if (
            item.mixins?.['PUSH_SUBSCRIPTION_DATA'].recipient_session_id === session.id &&
            item.mixins?.['PUSH_SUBSCRIPTION_DATA'].recipient_customer_id === session.customerId
          ) {
            // remove duplicates if we find them
            if (subscriptionId) {
              this.schemaApi.deleteCustomEntity(this.SUBSCRIPTION_TYPE, item.id);
            } else {
              // use existing subscription
              subscriptionId = item.id;
            }
          } else {
            // delete subscriptions on this endpoint and key for other sessions/customers
            this.schemaApi.deleteCustomEntity(this.SUBSCRIPTION_TYPE, item.id);
          }
        });
      }
      if (!subscriptionId) {
        const storefrontSubscription: Omit<StorefrontNotificationSubscription, 'id'> = {
          origin: baseUrl,
          keys: subscription.keys,
          endpoint: subscription.endpoint,
          recipient: {
            sessionId: session.id,
            customerId: session.customerId,
          },
        };
        subscriptionId = await this.schemaApi.createCustomEntity(
          this.SUBSCRIPTION_TYPE,
          this.mapSubscriptionToSource(storefrontSubscription),
        );
      }
      return subscriptionId;
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      throw new Error(
        `Failed to subscribe to push notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async unsubscribe(subscriptionId: string): Promise<void> {
    try {
      await this.schemaApi.deleteCustomEntity(this.SUBSCRIPTION_TYPE, subscriptionId);
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      throw new Error(
        `Failed to unsubscribe from push notifications: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  protected async getSubscriptionsForNotification(
    notification: StorefrontNotification,
  ): Promise<StorefrontNotificationSubscription[]> {
    try {
      if (!notification.recipient_type || !notification.recipient_id) {
        throw new Error('Notification recipient type or ID is missing');
      }
      let subscriptions: EmporixPaginatedResponse<EmporixCustomEntity>;
      switch (notification.recipient_type) {
        case 'SESSION':
          subscriptions = await this.schemaApi.getCustomEntities(this.SUBSCRIPTION_TYPE, {
            criteria: {
              'mixins.PUSH_SUBSCRIPTION_DATA.recipient_session_id': notification.recipient_id,
              'mixins.PUSH_SUBSCRIPTION_DATA.origin': baseUrl,
            },
          });
          break;
        case 'CUSTOMER':
          subscriptions = await this.schemaApi.getCustomEntities(this.SUBSCRIPTION_TYPE, {
            criteria: {
              'mixins.PUSH_SUBSCRIPTION_DATA.recipient_customer_id': notification.recipient_id,
              'mixins.PUSH_SUBSCRIPTION_DATA.origin': baseUrl,
            },
          });
          break;
        case 'CART_OWNER':
          const cart = await this.cartService.getCartById(notification.recipient_id, false);
          if (!cart) {
            return [];
          }
          if (cart.customerId) {
            subscriptions = await this.schemaApi.getCustomEntities(this.SUBSCRIPTION_TYPE, {
              criteria: {
                'mixins.PUSH_SUBSCRIPTION_DATA.recipient_customer_id': cart.customerId,
                'mixins.PUSH_SUBSCRIPTION_DATA.origin': baseUrl,
              },
            });
          } else {
            subscriptions = await this.schemaApi.getCustomEntities(this.SUBSCRIPTION_TYPE, {
              criteria: {
                'mixins.PUSH_SUBSCRIPTION_DATA.recipient_session_id': cart.sessionId,
                'mixins.PUSH_SUBSCRIPTION_DATA.origin': baseUrl,
              },
            });
          }
          break;
        case 'COMPANY':
          // TODO fetch all customer subscriptions of a company!
          return [];
        default:
          return [];
      }
      return subscriptions.items.map((item) => this.mapSubscriptionToService(item));
    } catch (error) {
      console.error('Failed to get subscriptions for notification:', error);
      throw new Error(
        `Failed to get subscriptions for notification: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async sendPushNotification(notificationId: string): Promise<void> {
    try {
      const notification = await this.getNotification(notificationId);
      if (!notification) {
        console.warn(`Notification ${notificationId} not found`);
        return;
      }
      const subscriptions = await this.getSubscriptionsForNotification(notification);

      await Promise.all(
        subscriptions.map(async (subscription) => {
          // Try to get the session to determine language preference
          let language = 'en';
          if (subscription.recipient.sessionId) {
            try {
              const session = await this.sessionService.getById(subscription.recipient.sessionId);
              if (session?.language) {
                language = session.language;
              }
            } catch (_err) {
              console.warn('Could not get session language, using default');
            }
          }

          // Use the augmentation service to enrich the notification
          const payload = await this.augmentationService.createPayload(notification, language);
          if (
            !process.env.VAPID_CONTACT ||
            !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
            !process.env.VAPID_PRIVATE_KEY
          ) {
            throw new Error('VAPID configuration is missing');
          }
          try {
            // Send the notification with the augmented payload
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: subscription.keys,
              },
              JSON.stringify(payload),
              {
                vapidDetails: {
                  subject: process.env.VAPID_CONTACT,
                  publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
                  privateKey: process.env.VAPID_PRIVATE_KEY,
                },
              },
            );
          } catch (_error) {
            // Fail silently
          }
        }),
      );
    } catch (error) {
      console.error('Failed to send push notification:', error);
      throw new Error(`Failed to send push notification: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get notifications by recipient type and ID
   */
  private async getNotificationsByRecipient(
    recipientType: RecipientType,
    recipientId: string,
  ): Promise<StorefrontNotification[]> {
    try {
      const response = await this.schemaApi.searchCustomEntities(this.NOTIFICATION_TYPE, {
        criteria: {
          'mixins.STOREFRONT_NOTIFICATION_DATA.recipient_type': recipientType,
          'mixins.STOREFRONT_NOTIFICATION_DATA.recipient_id': recipientId,
        },
      });

      return (response.items || []).map((item: EmporixCustomEntity) => this.mapNotificationToService(item));
    } catch (error) {
      console.error(`Failed to get notifications for ${recipientType} ${recipientId}:`, error);
      throw new Error(`Failed to get notifications: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Map API response to Notification model
   */
  private mapNotificationToService(response: EmporixCustomEntity): StorefrontNotification {
    const notification = response.mixins?.['STOREFRONT_NOTIFICATION_DATA'];
    if (!notification || !response.id) {
      throw new Error(`Notification ${response.id} does not have a STOREFRONT_NOTIFICATION_DATA mixin or id`);
    }
    let data = {};
    try {
      data = notification.data_json && notification.data_json.trim() !== '' ? JSON.parse(notification.data_json) : {};
    } catch (error) {
      console.warn(`Failed to parse notification data: ${error instanceof Error ? error.message : String(error)}`);
    }
    const metadata = response.metadata;
    if (!metadata) {
      throw new Error(`Notification ${response.id} does not have a metadata`);
    }
    const result = {
      id: response.id,
      code: notification.notification_code,
      type: notification.type,
      reference_type: notification.reference_type,
      reference_id: notification.reference_id,
      recipient_id: notification.recipient_id,
      recipient_type: notification.recipient_type,
      message: notification.message,
      data_json: data,
      created: metadata.createdAt,
      updated: metadata.modifiedAt,
    };
    result.data_json = this.convertDataJson(result);
    return result;
  }

  private mapSubscriptionToService(response: EmporixCustomEntity): StorefrontNotificationSubscription {
    const subscription = response.mixins?.['PUSH_SUBSCRIPTION_DATA'];
    if (!subscription || !response.id) {
      throw new Error(`Subscription ${response.id} does not have a PUSH_SUBSCRIPTION_DATA mixin or id`);
    }
    return {
      id: response.id,
      origin: subscription.origin,
      keys: {
        p256dh: subscription.p256dh_key,
        auth: subscription.auth_key,
      },
      endpoint: subscription?.endpoint,
      recipient: {
        sessionId: subscription.recipient_session_id,
        customerId: subscription.recipient_customer_id,
      },
    };
  }

  private mapSubscriptionToSource(subscription: Omit<StorefrontNotificationSubscription, 'id'>): EmporixCustomEntity {
    return {
      type: this.SUBSCRIPTION_TYPE,
      mixins: {
        PUSH_SUBSCRIPTION_DATA: {
          origin: baseUrl,
          auth_key: subscription.keys.auth,
          p256dh_key: subscription.keys.p256dh,
          endpoint: subscription.endpoint,
          recipient_session_id: subscription.recipient.sessionId,
          recipient_customer_id: subscription.recipient.customerId,
        },
      },
    };
  }

  private convertDataJson(notification: StorefrontNotification): any {
    switch (notification.code) {
      case 'SUBSTITUTION_AVAILABLE':
        return {
          productId: notification.data_json.productId,
          substitutions: notification.data_json.substitutions.map((sub: any) => ({
            productId: sub.SubstituteMaterialID,
            name: sub.SubstitutionMaterialName,
            availableQuantity: sub.InventoryAvailable,
          })),
        };
      case 'ITEM_PRICE_CHANGE':
      default:
        return notification.data_json;
    }
  }
}

export default EmporixNotificationServiceServer;
