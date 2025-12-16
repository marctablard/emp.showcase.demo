import { cache as reactCache } from 'react';

/**
 * A wrapper around React's cache function that handles object arguments.
 *
 * When object arguments are passed, they are stringified for cache key generation,
 * then parsed back before executing the original function logic.
 *
 * @example
 * ```typescript
 * const fetchData = cache(async (id: string, options: { includeDetails: boolean }) => {
 *   // options object will be properly handled for caching
 *   return await api.fetch(id, options);
 * });
 * ```
 */
export function cache<Args extends unknown[], Return>(fn: (...args: Args) => Return): (...args: Args) => Return {
  // Create a wrapper function that handles object serialization
  const wrappedFn = (...serializedArgs: string[]) => {
    // Parse the stringified arguments back to their original form
    const originalArgs = serializedArgs.map((arg) => {
      try {
        return JSON.parse(arg);
      } catch {
        // If parsing fails, return the original value (it wasn't an object)
        return arg;
      }
    }) as Args;

    // Call the original function with the parsed arguments
    return fn(...originalArgs);
  };

  // Apply React's cache to the wrapper function
  const cachedWrapper = reactCache(wrappedFn);

  // Return a function that stringifies arguments before passing to the cached wrapper
  return (...args: Args) => {
    const serializedArgs = args.map((arg) => {
      // Stringify objects and arrays, keep primitives as-is
      if (arg !== null && typeof arg === 'object') {
        return JSON.stringify(arg);
      }
      // Convert primitives to strings for consistent cache keys
      return String(arg);
    });

    return cachedWrapper(...serializedArgs);
  };
}
