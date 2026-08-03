/**
 * Starts an async task from inside a `useEffect` without writing state synchronously in the
 * effect body.
 *
 * Data-fetching callbacks in this codebase typically enter their loading state up front
 * (`setLoading(true)`) and clear it in a `finally`, both of which are reachable synchronously
 * when the effect calls them directly. That produces a cascading render inside the same commit
 * — what `react-hooks/set-state-in-effect` flags. Deferring the call by one microtask lets the
 * effect body return first, so every state write lands in its own render pass.
 *
 * The returned function is meant to be used as the effect's cleanup: it prevents a task from
 * starting at all if the effect is torn down before the microtask runs (e.g. rapid prop
 * changes, or Strict Mode's double-invoked effects in development).
 *
 * ```ts
 * useEffect(() => {
 *   if (!id) return;
 *   return startEffectTask(fetchThing);
 * }, [id, fetchThing]);
 * ```
 *
 * Note this only guards the *start* of the task. A task that is already in flight still runs to
 * completion and writes its result; callers that must discard a stale in-flight response need
 * their own guard on top of this.
 */
export function startEffectTask(run: () => Promise<unknown>): () => void {
  let cancelled = false;

  Promise.resolve()
    .then(() => (cancelled ? undefined : run()))
    .catch(() => {
      // `run` owns its error handling; nothing to do here beyond not leaving a rejected promise.
    });

  return () => {
    cancelled = true;
  };
}
