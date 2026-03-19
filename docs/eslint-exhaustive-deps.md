# ESLint Rule: `react-hooks/exhaustive-deps`

## Overview

The `react-hooks/exhaustive-deps` ESLint rule enforces that all dependencies used inside `useEffect`, `useCallback`, `useMemo`, and other React hooks are declared in their dependency array. This prevents bugs caused by stale closures.

However, there are legitimate cases where disabling this rule is the correct solution.

---

## When to Disable the Rule

### 1. **Mount-Only Effects with Stable Function References**

**Pattern:**
```tsx
useEffect(() => {
  refetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Why disable:**
- The intent is to run the effect **only once on mount**, not on every render
- `refetchOrders` is a stable function reference (doesn't change between renders)
- Adding it to the dependency array would be technically correct but semantically wrong—it changes the intended behavior from "run once" to "run whenever refetchOrders changes"
- The function is stable by design (from a custom hook or `useCallback`), so there's no risk of stale closures

**Alternative (not recommended here):**
```tsx
// ❌ Technically satisfies ESLint but changes behavior
useEffect(() => {
  refetchOrders();
}, [refetchOrders]); // Now runs whenever refetchOrders changes
```

---

### 2. **Intentional Partial Dependencies**

**Pattern:**
```tsx
useEffect(() => {
  if (initialOrders && !getStoreOrders(queryKey) && !getStoreLoading(queryKey)) {
    setStoreOrders(queryKey, initialOrders);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialOrders, queryKey]);
```

**Why disable:**
- You want the effect to run only when specific values change (`initialOrders`, `queryKey`)
- Other dependencies like `getStoreOrders` or `setStoreOrders` are stable functions that don't need to trigger re-runs
- Including all dependencies would cause unnecessary effect executions

---

### 3. **Avoiding Infinite Loops**

**Pattern:**
```tsx
useEffect(() => {
  if (initialCart !== undefined) {
    setCurrentCart(initialCart);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [initialCart]);
```

**Why disable:**
- `setCurrentCart` is a state setter function (stable reference)
- Including it in the dependency array is redundant and can cause confusion
- The effect should only run when `initialCart` changes, not when the setter changes (which it never does)

---

### 4. **External System Synchronization**

**Pattern:**
```tsx
useEffect(() => {
  let isCancelled = false;
  
  fetchWeatherData().then(data => {
    if (!isCancelled) {
      setWeather(data);
    }
  });
  
  return () => {
    isCancelled = true;
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Why disable:**
- The effect sets up a one-time subscription or initialization
- Re-running on every dependency change would create duplicate subscriptions
- The cleanup function properly handles cancellation

---

## When NOT to Disable the Rule

### ❌ Avoid Disabling for Actual Bugs

```tsx
// ❌ BAD: This is a real bug
useEffect(() => {
  const logger = getLogger();
  logger.info({ name: user.name }, 'User name'); // Uses `user` but doesn't declare it
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

**Problem:** The effect will always log the initial `user.name`, even if `user` changes. This is a stale closure bug.

**Fix:** Add `user` to dependencies or use `user.name` specifically:
```tsx
// ✅ GOOD
useEffect(() => {
  const logger = getLogger();
  logger.info({ name: user.name }, 'User name');
}, [user.name]);
```

---

## Best Practices

1. **Document why you're disabling the rule** with a comment above the disable directive
2. **Use inline disables** (`// eslint-disable-next-line`) rather than file-level disables
3. **Consider alternatives first:**
   - Move the function inside the effect
   - Use `useCallback` to stabilize function references
   - Split the effect into multiple effects with different dependencies
4. **Review regularly:** Disabled rules should be revisited when refactoring

---

## Example with Documentation

```tsx
// Fetch fresh order data when component mounts
useEffect(() => {
  refetchOrders();
  // Disable exhaustive-deps: refetchOrders is stable and we only want to run this once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

---

## Summary

Disabling `react-hooks/exhaustive-deps` is appropriate when:
- ✅ You intentionally want mount-only behavior
- ✅ Dependencies are stable by design (state setters, memoized functions)
- ✅ Including all dependencies would change the intended behavior
- ✅ You understand the implications and document the reasoning

It's **not** appropriate when:
- ❌ You're trying to hide a real stale closure bug
- ❌ You haven't considered proper alternatives
- ❌ You don't understand why ESLint is complaining
