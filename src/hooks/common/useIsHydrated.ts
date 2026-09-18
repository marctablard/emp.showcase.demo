'use client';

import { useSyncExternalStore } from 'react';

/**
 * `false` during server rendering and the first client pass, `true` afterwards.
 *
 * Components whose output depends on `localStorage` (persisted state stores)
 * render nothing on the server and a whole subtree on the client. That is a
 * structural difference, at which React aborts hydration and rebuilds the
 * subtree — surfacing as "Hydration failed". Rendering nothing until mount
 * makes the first client pass match the server; the real content follows in
 * the second.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: the common
 * pattern drives the second pass out of an effect, which is what the
 * `set-state-in-effect` rule reports. Here React performs the switch itself —
 * `getServerSnapshot` returns `false`, `getSnapshot` returns `true`, and since
 * `subscribe` never notifies there is neither a subscription nor a follow-up
 * render beyond the hydration pass.
 *
 * Deliberately here and not in the store: `skipHydration` on the persistence
 * layer would affect every consumer and silently disable persistence if a
 * rehydrate call were ever lost.
 */

/** Never notifies — the value changes exactly once, on the server → client transition. */
const subscribe = () => () => {};

const getSnapshot = () => true;

const getServerSnapshot = () => false;

export function useIsHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
