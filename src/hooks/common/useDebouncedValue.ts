import { useEffect, useState } from 'react';

/**
 * Returns a debounced version of the provided value.
 * The returned value only updates after the specified delay has passed
 * without the input value changing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = globalThis.setTimeout(() => setDebounced(value), delayMs);
    return () => globalThis.clearTimeout(id);
  }, [value, delayMs]);

  return debounced;
}
