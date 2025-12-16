import { enableMapSet } from 'immer';
import { create } from 'zustand/react';
import type {
  StorefrontNotification,
  WebPushSubscriptionRegistration,
} from '@/platform/services/model/notification/notification';

// Enable MapSet support for Immer
enableMapSet();

// re-export for convenience
export { useNotificationStore } from '@/providers/StoreProvider';

// Type for notification listener callbacks
export type NotificationListener = (notification: StorefrontNotification | string) => boolean | void;

// Interface for notification subscription
export interface NotificationSubscription {
  id: string;
  reference_type: string;
  listener: NotificationListener;
}

export interface NotificationState {
  // Push notification support
  isPushSupported?: boolean;
  subscription: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'PENDING';
  permissionState?: NotificationPermission | null;
  error: string | null;
  notifications: StorefrontNotification[];
}

export interface NotificationActions {
  // Push notification support
  checkSupport: () => Promise<boolean>;
  registerServiceWorker: () => Promise<ServiceWorkerRegistration | null>;
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;

  start: () => Promise<void>;

  // Notification data management
  fetchNotifications: () => Promise<void>;

  // Polling control
  startPolling: () => void;
  stopPolling: () => void;

  // Reference type subscriptions
  registerNotificationListener: (referenceType: string, listener: NotificationListener) => string;
  // Get Notifications
  getNotifications: (type: 'CART' | 'CUSTOMER' | 'COMPANY', id: string) => Promise<StorefrontNotification[]>;
  // Unregister Notification
  unregisterNotificationListener: (subscriptionId: string) => void;
  notifyListeners: (notification: StorefrontNotification | string) => boolean;
  markNotificationAsRead: (id: string) => Promise<void>;
}

const defaultState: NotificationState = {
  isPushSupported: undefined,
  subscription: 'UNSUBSCRIBED',
  permissionState: undefined,
  error: null,
  notifications: [],
};

export const createNotificationStore = (initState: NotificationState = defaultState) => {
  // Create memory-only variables outside the persisted store
  let listeners: NotificationSubscription[] = [];
  // Read polling interval from environment variable (in seconds)
  // The value is interpreted as seconds and converted to milliseconds for setInterval
  const pollingIntervalEnv = process.env.NEXT_PUBLIC_NOTIFICATION_POLLING_INTERVAL_SECONDS;
  const pollingInterval = pollingIntervalEnv ? Number(pollingIntervalEnv) * 1000 : 30000; // Default: 30 seconds
  const pushNotificationsDisabled = process.env.NEXT_PUBLIC_DISABLE_PUSH_NOTIFICATIONS === 'true';
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const notificationsFeatureEnabled = !pushNotificationsDisabled && !!vapidPublicKey;
  let pollingIntervalId: ReturnType<typeof setInterval> | null = null;

  // Mutex flag to prevent duplicate fetchNotifications calls
  let isFetching = false;
  let isPolling = false;
  let started = false;

  return create<NotificationState & NotificationActions>()((set, get) => ({
    ...initState,

    // Start
    start: async () => {
      if (started) {
        return;
      }
      started = true;

      if (!notificationsFeatureEnabled) {
        set({
          isPushSupported: false,
          permissionState: null,
        });
        return;
      }

      get()
        .checkSupport()
        .then((supported) => {
          if (supported) {
            get()
              .registerServiceWorker()
              .then((registration) => {
                if (registration) {
                  get().subscribe();
                } else {
                  get().startPolling();
                }
              });
          } else {
            get().startPolling();
          }
        });
    },
    // Reference type subscriptions - stored in memory only, not persisted
    registerNotificationListener: (referenceType: string, listener: NotificationListener) => {
      const subscriptionId = `${referenceType}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Add to in-memory listeners array instead of state
      listeners.push({ id: subscriptionId, reference_type: referenceType, listener });

      // Notify freshly registered listener with known notifications
      get()
        .notifications.filter((notification) => notification.reference_type === referenceType)
        .forEach((notification) => {
          listener(notification);
        });

      return subscriptionId;
    },

    unregisterNotificationListener: (listenerId: string) => {
      // Filter in-memory listeners array
      listeners = listeners.filter((sub) => sub.id !== listenerId);
    },

    notifyListeners: (notification: StorefrontNotification | string) => {
      if (typeof notification === 'string') {
        listeners.forEach((listener) => {
          listener.listener(notification);
        });
        return true;
      }
      // Use in-memory listeners instead of from state
      let isConsumed = false;

      // Find relevant subscribers for this notification's reference type
      const relevantListeners = listeners.filter((sub) => notification.reference_type === sub.reference_type);

      // Notify each subscriber and check if any wants to consume the notification
      for (const listener of relevantListeners) {
        try {
          const result = listener.listener(notification);
          if (result === true) {
            isConsumed = true;
          }
        } catch (error) {
          console.error(`Error in notification listener ${listener.id}:`, error);
        }
      }

      return isConsumed;
    },

    // Check if push notifications are supported
    checkSupport: async (): Promise<boolean> => {
      const { isPushSupported, permissionState } = get();
      if (isPushSupported !== undefined && permissionState !== undefined) {
        console.log('Using cached result', isPushSupported, permissionState);
        return isPushSupported == true && permissionState === 'granted';
      }
      try {
        if (!notificationsFeatureEnabled) {
          set({
            isPushSupported: false,
            permissionState: null,
          });
          return false;
        }

        // Check if push notifications are disabled via environment variable
        const pushNotificationsDisabledRuntime = process.env.NEXT_PUBLIC_DISABLE_PUSH_NOTIFICATIONS === 'true';

        // Only consider push notifications supported if they're not disabled and browser supports them
        const browserSupport =
          !pushNotificationsDisabledRuntime &&
          typeof window !== 'undefined' &&
          'serviceWorker' in navigator &&
          'PushManager' in window &&
          'Notification' in window;

        if (!browserSupport) {
          set({
            isPushSupported: false,
            permissionState: null,
          });
          return false;
        }
        console.log('Push notifications are supported');
        // Request permission if needed
        if (Notification.permission !== 'granted') {
          console.log('Requesting notification permission');
          await Notification.requestPermission();
        }
        const permissionState = Notification.permission as NotificationPermission;
        console.log('Permission state:', permissionState);
        set({
          isPushSupported: true,
          permissionState,
        });
        return permissionState === 'granted';
      } catch (error) {
        console.error('Error checking push notification status:', error);
        set({
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        return false; // Return false on error
      }
    },

    // Register service worker
    registerServiceWorker: async (): Promise<ServiceWorkerRegistration | null> => {
      if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
        set({
          error: 'Service workers are not supported in this browser',
        });
        return null;
      }

      if (!get().isPushSupported) {
        console.log('Push notifications are not supported in this browser');
        set({
          error: 'Push notifications are not supported in this browser',
        });
        return null;
      }

      try {
        console.log('Registering service worker');
        const registration = await navigator.serviceWorker.register('/notification-worker.js');
        return registration;
      } catch (error) {
        console.error('Service worker registration failed:', error);
        set({
          error: `Service worker registration failed: ${error instanceof Error ? error.message : String(error)}`,
        });
        return null;
      }
    },

    // Subscribe to push notifications
    subscribe: async () => {
      // Check if push notifications are disabled via environment variable
      if (!notificationsFeatureEnabled || !get().isPushSupported) {
        console.log('Push notifications are disabled via configuration');
        set({
          error: 'Push notifications are currently disabled',
        });
        return;
      }
      if (get().subscription === 'PENDING') {
        console.log('Already subscribing to push notifications');
        return;
      }
      set({
        subscription: 'PENDING',
      });

      try {
        // Make sure service worker is registered
        const registration = await navigator.serviceWorker.ready;

        // Get VAPID public key
        const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
        if (!vapidPublicKey) {
          throw new Error('VAPID public key is not available');
        }

        // Convert VAPID key to Uint8Array
        const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
        // Subscribe to push service
        let subscription: PushSubscription | null = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey,
          });
        }
        const p256dh = subscription.getKey('p256dh');
        const auth = subscription.getKey('auth');
        if (!p256dh || !auth) {
          throw new Error('Invalid subscription data');
        }
        const subcriptionRegistration: WebPushSubscriptionRegistration = {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime,
          keys: {
            p256dh: btoa(String.fromCharCode(...new Uint8Array(p256dh))),
            auth: btoa(String.fromCharCode(...new Uint8Array(auth))),
          },
        };
        await fetch('/api/notifications/subscriptions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(subcriptionRegistration),
        });
        // Stop polling when subscribing to push notifications
        get().stopPolling();

        set({
          subscription: 'SUBSCRIBED',
          error: null,
        });

        get().fetchNotifications();
      } catch (error) {
        console.error('Subscription error:', error);
        set({
          subscription: 'UNSUBSCRIBED',
          error: `Subscription failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },

    // Unsubscribe from push notifications
    unsubscribe: async () => {
      try {
        if (get().subscription !== 'SUBSCRIBED') {
          throw new Error('No active subscription found');
        }

        // Subscribe to push service
        const registration = await navigator.serviceWorker.ready;
        const subscription: PushSubscription | null = await registration.pushManager.getSubscription();
        if (!subscription) {
          throw new Error('No active subscription found');
        }
        // Unsubscribe from push service
        const unsubscribed = await subscription.unsubscribe();
        if (!unsubscribed) {
          throw new Error('Failed to unsubscribe from push service');
        }
        // Notify server about unsubscription
        try {
          await fetch('/api/subscriptions', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(subscription),
          });
        } catch (unsubscribeError) {
          console.error('Error notifying server about unsubscription:', unsubscribeError);
          // Continue even if server notification fails
        }
        // Start polling as fallback only if interval > 0
        if (pollingInterval > 0) {
          get().startPolling();
        } else {
          console.log('Polling not started after unsubscribe because interval is set to 0');
        }
        set({
          subscription: 'UNSUBSCRIBED',
          error: null,
        });

        console.log('Push notification unsubscription successful');
      } catch (error) {
        console.error('Unsubscription error:', error);
        set({
          error: `Unsubscription failed: ${error instanceof Error ? error.message : String(error)}`,
        });
      }
    },

    // Fetch notifications from the API
    fetchNotifications: async () => {
      if (!notificationsFeatureEnabled) {
        return;
      }
      // If already fetching, skip this request
      if (isFetching) {
        console.debug('Notification fetch already in progress, skipping duplicate request');
        return;
      }

      try {
        // Set mutex flag
        isFetching = true;

        const response = await fetch('/api/notifications', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch notifications: ${response.statusText}`);
        }

        const data = await response.json();
        set({
          notifications: data.notifications,
        });
        if (data.notifications && data.notifications.length > 0) {
          // Process new notifications
          const newNotifications = data.notifications;

          // Check if any subscribers want to consume these notifications
          const consumedIds = new Set<string>();

          // Process each notification through subscribers
          newNotifications.forEach((notification: StorefrontNotification) => {
            const isConsumed = get().notifyListeners(notification);
            if (isConsumed) {
              consumedIds.add(notification.id);
            }
          });
        }
      } catch (error) {
        console.error('Error fetching notifications:', error);
        set({ error: error instanceof Error ? error.message : 'Unknown error' });
      } finally {
        // Always clear the mutex flag when done, even if there was an error
        isFetching = false;
      }
    },
    getNotifications: async (type: 'CART' | 'CUSTOMER' | 'COMPANY', id: string) => {
      await get().fetchNotifications();
      return get().notifications.filter((notification) => {
        switch (notification.reference_type) {
          default:
            return notification.reference_type === type && notification.reference_id === id;
        }
      });
    },
    // Start polling for notifications
    startPolling: () => {
      // Do not start polling if interval is 0
      if (pollingInterval === 0) {
        console.log('Polling is disabled because interval is set to 0');
        return;
      }
      // Don't start polling if already polling
      if (isPolling) {
        return;
      }

      console.log('Starting polling for notifications');

      // Clear any existing interval
      if (pollingIntervalId) {
        clearInterval(pollingIntervalId);
      }

      // Then set up the interval
      pollingIntervalId = setInterval(() => {
        console.log('Polling for notifications');
        get().fetchNotifications();
      }, pollingInterval);

      // Update memory variable
      isPolling = true;
      get().fetchNotifications();
    },

    // Stop polling for notifications
    stopPolling: () => {
      if (pollingIntervalId) {
        console.log('Stopping polling for notifications');
        clearInterval(pollingIntervalId);
      }

      // Update memory variables
      isPolling = false;
      pollingIntervalId = null;
    },
    markNotificationAsRead: async (id: string) => {
      set({ notifications: get().notifications.filter((notification) => notification.id !== id) });
      await fetch('/api/notifications?id=' + id, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      get().notifyListeners(id);
      return Promise.resolve();
    },
  }));
};

/**
 * Helper function to convert base64 string to Uint8Array
 * (required for applicationServerKey)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}
