import { useEffect } from 'react';
import type { ReferenceType, StorefrontNotification } from '@/platform/services/model/notification/notification';
import { useNotificationStore } from '@/providers/StoreProvider';
import { NotificationListener } from '@/stores/notification-store';

interface UseNotificationsReturn {
  error: string | null;
  markNotificationAsRead: (id: string) => Promise<void>;
  registerNotificationListener: (referenceType: ReferenceType, listener: NotificationListener) => string;
  unregisterNotificationListener: (subscriptionId: string) => void;
  getNotifications: (type: 'CART' | 'CUSTOMER' | 'COMPANY', id: string) => Promise<StorefrontNotification[]>;
  fetchNotifications: () => Promise<void>;
}

/**
 * Hook for managing push notification subscriptions
 * Uses a centralized store to avoid multiple polling instances
 */
export function useNotifications(): UseNotificationsReturn {
  const {
    error,
    start,
    registerNotificationListener,
    unregisterNotificationListener,
    getNotifications,
    markNotificationAsRead,
    fetchNotifications,
  } = useNotificationStore();

  useEffect(() => {
    start();
  }, [start]);

  // Listen for messages from the service worker
  useEffect(() => {
    // Add the event listener
    if (navigator.serviceWorker) {
      const handleServiceWorkerMessage = (event: MessageEvent) => {
        // Check if the message is a notification update
        if (event.data && event.data.type === 'NEW_NOTIFICATION') {
          // Trigger a refetch of notifications
          fetchNotifications();
        }
      };

      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);

      // Clean up the event listener when the component unmounts
      return () => {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      };
    }
  }, [fetchNotifications]);

  return {
    error,
    markNotificationAsRead,
    registerNotificationListener,
    unregisterNotificationListener,
    getNotifications,
    fetchNotifications,
  };
}
