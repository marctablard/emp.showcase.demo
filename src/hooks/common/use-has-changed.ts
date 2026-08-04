import { useState } from 'react';

/**
 * Reports whether `value` differs from what it was on the previous render, and remembers the new
 * value for the next comparison.
 *
 * This is the plumbing behind React's "adjusting state when a prop changes" pattern
 * (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes),
 * which replaces effects that exist only to copy a prop into state. Adjusting during render keeps
 * the update in the same pass instead of causing the extra commit an effect would.
 *
 * ```ts
 * const quantityChanged = useHasChanged(item.quantity);
 * if (quantityChanged && item.quantity !== quantity) {
 *   setQuantity(item.quantity);
 * }
 * ```
 *
 * Comparison is by `Object.is`, so pass a primitive or a value with a stable identity. A value
 * that is freshly allocated on every render (an inline array/object) would report a change every
 * time and never settle — derive a content key for those.
 */
export function useHasChanged<T>(value: T): boolean {
  const [previous, setPrevious] = useState(value);

  if (Object.is(previous, value)) {
    return false;
  }

  setPrevious(value);
  return true;
}
