'use client';

import { useCallback, useEffect, useState } from 'react';

interface UsePersistedStateOptions<T> {
  key: string;
  defaultValue: T;
  storage?: 'localStorage' | 'sessionStorage';
  serialize?: (value: T) => string;
  deserialize?: (value: string) => T;
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
}: UsePersistedStateOptions<T>): [T, (value: T | ((prev: T) => T)) => void, () => void] {
  const storageApi =
    typeof window !== 'undefined' ? (storage === 'localStorage' ? localStorage : sessionStorage) : null;

  const [state, setState] = useState<T>(() => {
    if (!storageApi) return defaultValue;
    try {
      const stored = storageApi.getItem(key);
      return stored ? deserialize(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    if (!storageApi) return;
    try {
      storageApi.setItem(key, serialize(state));
    } catch (error) {
      console.warn(`[usePersistedState] Failed to persist ${key}:`, error);
    }
  }, [key, state, storageApi, serialize]);

  const clear = useCallback(() => {
    setState(defaultValue);
    storageApi?.removeItem(key);
  }, [defaultValue, key, storageApi]);

  return [state, setState, clear];
}
