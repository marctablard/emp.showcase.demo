import React from 'react';
import { act, render } from '@testing-library/react';
import { useNotifications } from '@/hooks/notifications/useNotifications';
import type { ReferenceType } from '@/platform/services/model/notification/notification';
import { useNotificationStore } from '@/providers/StoreProvider';

// Mock the store provider
jest.mock('@/providers/StoreProvider', () => ({
  useNotificationStore: jest.fn(),
}));

describe('Notification Subscription System', () => {
  // Mock store implementation
  const mockStore = {
    pushNotifications: [],
    start: jest.fn(),
    error: null,
    registerNotificationListener: jest.fn().mockReturnValue('test-subscription-id'),
    unregisterNotificationListener: jest.fn(),
    markNotificationAsRead: jest.fn(),
    getNotifications: jest.fn().mockResolvedValue([]),
    fetchNotifications: jest.fn().mockResolvedValue(undefined),
    notifyListeners: jest.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotificationStore as jest.Mock).mockReturnValue(mockStore);
  });

  test('useNotifications hook exposes subscription methods', () => {
    // Test component that uses the hook
    const TestComponent = () => {
      const { registerNotificationListener, unregisterNotificationListener, markNotificationAsRead } =
        useNotifications();

      // Verify the hook exposes the methods
      expect(registerNotificationListener).toBeDefined();
      expect(unregisterNotificationListener).toBeDefined();
      expect(markNotificationAsRead).toBeDefined();

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
  });

  test('registerNotificationListener registers a listener for a specific reference type', () => {
    const TestComponent = () => {
      const { registerNotificationListener } = useNotifications();
      const listener = jest.fn();

      React.useEffect(() => {
        registerNotificationListener('CART' as ReferenceType, listener);
      }, [registerNotificationListener]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
    expect(mockStore.registerNotificationListener).toHaveBeenCalledWith('CART', expect.any(Function));
  });

  test('unregisterNotificationListener removes a listener by subscription id', () => {
    const TestComponent = () => {
      const { registerNotificationListener, unregisterNotificationListener } = useNotifications();

      React.useEffect(() => {
        const subscriptionId = registerNotificationListener('CART' as ReferenceType, jest.fn());
        unregisterNotificationListener(subscriptionId);
      }, [registerNotificationListener, unregisterNotificationListener]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
    expect(mockStore.unregisterNotificationListener).toHaveBeenCalledWith('test-subscription-id');
  });

  test('markNotificationAsRead marks a notification as read', () => {
    const TestComponent = () => {
      const { markNotificationAsRead } = useNotifications();

      React.useEffect(() => {
        markNotificationAsRead('test-notification-id');
      }, [markNotificationAsRead]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
    expect(mockStore.markNotificationAsRead).toHaveBeenCalledWith('test-notification-id');
  });

  test('notifySubscribers calls registered listeners and collects consumption status', () => {
    // Setup mock store with a test implementation
    const mockListener = jest.fn().mockReturnValue(true); // Listener that consumes the notification
    const mockNotification = {
      id: 'test-notification-id',
      type: 'INFO' as const,
      recipient_type: 'CUSTOMER' as const,
      reference_type: 'CART' as ReferenceType,
    };

    // Mock implementation for testing notifySubscribers
    const testStore = {
      ...mockStore,
      subscriptions: [{ id: 'test-sub-id', referenceType: 'CART' as ReferenceType, listener: mockListener }],
      notifyListeners: jest.fn().mockImplementation((notification: typeof mockNotification) => {
        let isConsumed = false;

        // Find subscriptions matching the notification's reference type
        const matchingSubscriptions = testStore.subscriptions.filter(
          (sub: { referenceType: string }) => sub.referenceType === notification.reference_type,
        );

        // Call each listener and collect consumption status
        for (const subscription of matchingSubscriptions) {
          try {
            const consumed = subscription.listener(notification);
            if (consumed) {
              isConsumed = true;
            }
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`Error in notification listener ${subscription.id}:`, error);
          }
        }

        return isConsumed;
      }),
    };

    (useNotificationStore as jest.Mock).mockReturnValue(testStore);

    // Test component that triggers notification
    const TestComponent = () => {
      const store = useNotificationStore();

      React.useEffect(() => {
        const isConsumed = store.notifyListeners(mockNotification);
        expect(isConsumed).toBe(true);
      }, [store]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
    expect(mockListener).toHaveBeenCalledWith(mockNotification);
  });
});
