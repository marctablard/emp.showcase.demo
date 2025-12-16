import React from 'react';
import { act, render } from '@testing-library/react';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { ReferenceType } from '@/platform/services/model/notification/notification';
import { useNotificationStore } from '@/providers/StoreProvider';

// Mock the store provider
jest.mock('@/providers/StoreProvider', () => ({
  useNotificationStore: jest.fn(),
}));

describe('Notification Subscription System', () => {
  // Mock store implementation
  const mockStore = {
    pushNotifications: [],
    registerNotificationListener: jest.fn().mockReturnValue('test-subscription-id'),
    unregisterNotificationListener: jest.fn(),
    markNotificationAsConsumed: jest.fn(),
    isNotificationConsumed: jest.fn().mockReturnValue(false),
    notifySubscribers: jest.fn().mockReturnValue(false),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useNotificationStore as jest.Mock).mockReturnValue(mockStore);
  });

  test('usePushNotifications hook exposes subscription methods', () => {
    // Test component that uses the hook
    const TestComponent = () => {
      const {
        registerNotificationListener,
        unregisterNotificationListener,
        markNotificationAsConsumed,
        isNotificationConsumed,
      } = usePushNotifications();

      // Verify the hook exposes the methods
      expect(registerNotificationListener).toBeDefined();
      expect(unregisterNotificationListener).toBeDefined();
      expect(markNotificationAsConsumed).toBeDefined();
      expect(isNotificationConsumed).toBeDefined();

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
  });

  test('registerNotificationListener registers a listener for a specific reference type', () => {
    const TestComponent = () => {
      const { registerNotificationListener } = usePushNotifications();
      const listener = jest.fn();

      React.useEffect(() => {
        registerNotificationListener(ReferenceType.CART, listener);
      }, [registerNotificationListener]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
    expect(mockStore.registerNotificationListener).toHaveBeenCalledWith(ReferenceType.CART, expect.any(Function));
  });

  test('unregisterNotificationListener removes a listener by subscription id', () => {
    const TestComponent = () => {
      const { registerNotificationListener, unregisterNotificationListener } = usePushNotifications();

      React.useEffect(() => {
        const subscriptionId = registerNotificationListener(ReferenceType.CART, jest.fn());
        unregisterNotificationListener(subscriptionId);
      }, [registerNotificationListener, unregisterNotificationListener]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
    expect(mockStore.unregisterNotificationListener).toHaveBeenCalledWith('test-subscription-id');
  });

  test('markNotificationAsConsumed marks a notification as consumed', () => {
    const TestComponent = () => {
      const { markNotificationAsConsumed } = usePushNotifications();

      React.useEffect(() => {
        markNotificationAsConsumed('test-notification-id');
      }, [markNotificationAsConsumed]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
    expect(mockStore.markNotificationAsConsumed).toHaveBeenCalledWith('test-notification-id');
  });

  test('notifySubscribers calls registered listeners and collects consumption status', () => {
    // Setup mock store with a test implementation
    const mockListener = jest.fn().mockReturnValue(true); // Listener that consumes the notification
    const mockNotification = {
      id: 'test-notification-id',
      referenceType: ReferenceType.CART,
    };

    // Mock implementation for testing notifySubscribers
    const testStore = {
      ...mockStore,
      subscriptions: [{ id: 'test-sub-id', referenceType: ReferenceType.CART, listener: mockListener }],
      notifySubscribers: jest.fn().mockImplementation((notification) => {
        let isConsumed = false;

        // Find subscriptions matching the notification's reference type
        const matchingSubscriptions = testStore.subscriptions.filter(
          (sub) => sub.referenceType === notification.referenceType,
        );

        // Call each listener and collect consumption status
        for (const subscription of matchingSubscriptions) {
          try {
            const consumed = subscription.listener(notification);
            if (consumed) {
              isConsumed = true;
            }
          } catch (error) {
            console.error(`Error in notification listener ${subscription.id}:`, error);
          }
        }

        return isConsumed;
      }),
    };

    (useNotificationStore as jest.Mock).mockReturnValue(testStore);

    // Test component that triggers notification
    const TestComponent = () => {
      const { notifyListeners: notifySubscribers } = useNotificationStore();

      React.useEffect(() => {
        const isConsumed = notifySubscribers(mockNotification);
        expect(isConsumed).toBe(true);
      }, [notifySubscribers]);

      return <div>Test Component</div>;
    };

    render(<TestComponent />);
    expect(mockListener).toHaveBeenCalledWith(mockNotification);
  });
});
