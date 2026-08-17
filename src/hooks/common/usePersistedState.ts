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

function getBrowserStorage(kind: 'localStorage' | 'sessionStorage'): Storage | null {
  if (globalThis.window === undefined) {
    return null;
  }
  if (kind === 'sessionStorage') {
    return sessionStorage;
  }
  return localStorage;
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
  const storageApi = getBrowserStorage(storage);

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

  // Adjust when key/enabled change during render (React "adjusting state when a
  // prop changes"). An effect is rejected by react-hooks/set-state-in-effect, and
  // React discards this first render so the persist effect never writes the previous
  // value into the new key.
  if (key !== hydratedKey || enabled !== hydratedEnabled) {
    setHydratedKey(key);
    setHydratedEnabled(enabled);
    setState(readStored());
  }

  useEffect(() => {
    if (!enabled || !storageApi || key !== hydratedKey || enabled !== hydratedEnabled) {
      return;
    }
    try {
      storageApi.setItem(key, serialize(state));
    } catch (error) {
      getLogger().warn({ err: error, key }, '[usePersistedState] Failed to persist key');
    }
  }, [enabled, hydratedEnabled, hydratedKey, key, serialize, state, storageApi]);

  const clear = useCallback(() => {
    setState(defaultValue);
    if (enabled) {
      storageApi?.removeItem(key);
    }
  }, [defaultValue, enabled, key, storageApi]);

  return [state, setState, clear];
}
