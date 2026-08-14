'use client';

import { useCallback, useEffect, useState } from 'react';
import { getLogger } from '@/lib/logger/use-logger-client';

interface UsePersistedStateOptions<T> {
  key: string;
  defaultValue: T;
  storage?: 'localStorage' | 'sessionStorage';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
  /** When false, state stays in memory and storage is not read or written. */
  enabled?: boolean;
}

/**
 * Hook for persisting state to localStorage or sessionStorage
 * @param options - Configuration options
 * @returns Tuple of [state, setState, clear]
 */
export function usePersistedState<T>({
  key,
  defaultValue,
  storage = 'localStorage',
  serialize = JSON.stringify,
  deserialize = JSON.parse,
  enabled = true,
}: UsePersistedStateOptions<T>): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const storageApi =
    typeof window !== 'undefined' ? (storage === 'localStorage' ? localStorage : sessionStorage) : null;

  const readStored = (): T => {
    if (!enabled || !storageApi) {
      return defaultValue;
    }
    try {
      const stored = storageApi.getItem(key);
      return stored ? deserialize(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  };

  const [hydratedKey, setHydratedKey] = useState(key);
  const [hydratedEnabled, setHydratedEnabled] = useState(enabled);
  const [state, setState] = useState<T>(readStored);

  if (key !== hydratedKey || enabled !== hydratedEnabled) {
    setHydratedKey(key);
    setHydratedEnabled(enabled);
    setState(readStored());
  }

  useEffect(() => {
    if (!enabled || !storageApi || key !== hydratedKey) {
      return;
    }
    try {
      storageApi.setItem(key, serialize(state));
    } catch (error) {
      getLogger().warn({ err: error, key }, '[usePersistedState] Failed to persist key');
    }
  }, [enabled, hydratedKey, key, serialize, state, storageApi]);

  const clear = useCallback(() => {
    setState(defaultValue);
    if (enabled) {
      storageApi?.removeItem(key);
    }
  }, [defaultValue, enabled, key, storageApi]);

  return [state, setState, clear];
}
