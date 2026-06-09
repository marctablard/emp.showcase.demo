'use client';

import { getLogger } from '@/lib/logger/use-logger-client';

/**
 * Clear all persisted stores from localStorage and sessionStorage during logout
 */
export const clearAllPersistedStores = (): void => {
  const localStorageKeys = [
    process.env.NEXT_PUBLIC_HISTORY_STORAGE_NAME || 'history-storage',
    process.env.NEXT_PUBLIC_DASHBOARD_STORAGE_NAME || 'dashboard-storage',
  ];

  localStorageKeys.forEach((key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      getLogger().error({ err: error, storageKey: key }, 'Error clearing localStorage item');
    }
  });

  // Checkout store persists shipping/billing addresses, payment and shipping
  // method selections to sessionStorage under 'emp-checkout'. Without clearing
  // it on logout, addresses picked while authenticated (including B2B
  // legal-entity locations) leak into the subsequent anonymous checkout and
  // get POSTed to Emporix, where the cart calc rejects the mismatched context
  // with "cannot calculate the cart".
  const sessionStorageKeys = ['emp-checkout'];
  sessionStorageKeys.forEach((key) => {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      getLogger().error({ err: error, storageKey: key }, 'Error clearing sessionStorage item');
    }
  });
};
