import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import { useHasChanged } from './use-has-changed';

/**
 * Local state that follows an upstream value whenever that value changes, but can be set freely
 * in between.
 *
 * This is the shape behind inputs that are seeded from a prop and edited locally — a quantity
 * stepper on a cart line, for example: the user's edits live in local state, and a change coming
 * back from the server (or from another view of the same item) takes over again.
 *
 * The hand-off happens during render rather than from an effect, so the new upstream value is
 * rendered in the same pass instead of flashing the stale one first. See
 * https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
 *
 * `upstream` is compared with `Object.is`, so pass a primitive or a value with a stable identity.
 */
export function useSyncedState<T>(upstream: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState(upstream);
  const upstreamChanged = useHasChanged(upstream);

  if (upstreamChanged && !Object.is(upstream, value)) {
    setValue(upstream);
  }

  return [value, setValue];
}
