import { isAuthenticatedSessionCustomerId } from '@/lib/common/customer-identity';

/**
 * Browser-only Frontend Agent conversation storage (COP-6181).
 *
 * Keys are scoped to the Emporix customer id, not NextAuth, so two shoppers on the
 * same browser cannot read each other's transcript. Unscoped legacy keys and other
 * shoppers' namespaces are pruned when a current owner is adopted. Unrelated
 * localStorage (dashboard layout, history, auth) is never scanned or deleted.
 */
export const AI_HELPER_STORAGE_NAMESPACE = 'ai-helper.v1';

export const LEGACY_AI_HELPER_STORAGE_KEYS = {
  sessionId: 'ai-session-id',
  messages: 'ai-helper-chat-messages',
  chatMode: 'ai-helper-chat-mode',
} as const;

const LEGACY_KEY_SET = new Set<string>(Object.values(LEGACY_AI_HELPER_STORAGE_KEYS));

export function isAIHelperStorageOwnerId(ownerId: string | undefined): ownerId is string {
  return isAuthenticatedSessionCustomerId(ownerId);
}

export function aiHelperStorageKeys(ownerId: string): {
  sessionId: string;
  messages: string;
  chatMode: string;
} {
  const encodedOwner = encodeURIComponent(ownerId);
  return {
    sessionId: `${AI_HELPER_STORAGE_NAMESPACE}:${encodedOwner}:sessionId`,
    messages: `${AI_HELPER_STORAGE_NAMESPACE}:${encodedOwner}:messages`,
    chatMode: `${AI_HELPER_STORAGE_NAMESPACE}:${encodedOwner}:chatMode`,
  };
}

function isNamespacedAIHelperKey(key: string): boolean {
  return key.startsWith(`${AI_HELPER_STORAGE_NAMESPACE}:`);
}

function belongsToOwner(key: string, ownerId: string): boolean {
  return key.startsWith(`${AI_HELPER_STORAGE_NAMESPACE}:${encodeURIComponent(ownerId)}:`);
}

function removeLocalStorageKeys(predicate: (key: string) => boolean): void {
  if (globalThis.window === undefined) {
    return;
  }

  for (const key of Object.keys(localStorage)) {
    if (predicate(key)) {
      localStorage.removeItem(key);
    }
  }
}

/** Drops pre-namespace keys that are not bound to any shopper. */
export function clearUnscopedAIHelperStorage(): void {
  removeLocalStorageKeys((key) => LEGACY_KEY_SET.has(key));
}

/**
 * Keep only this shopper's namespaced Helper keys. Removes leftover unscoped keys
 * and other shoppers' `ai-helper.v1:` entries.
 */
export function adoptAIHelperStorage(ownerId: string): void {
  if (!isAIHelperStorageOwnerId(ownerId)) {
    return;
  }

  removeLocalStorageKeys(
    (key) => LEGACY_KEY_SET.has(key) || (isNamespacedAIHelperKey(key) && !belongsToOwner(key, ownerId)),
  );
}

/** Removes every Helper key (legacy + all shoppers). Used on logout. */
export function clearAIHelperClientState(): void {
  removeLocalStorageKeys((key) => LEGACY_KEY_SET.has(key) || isNamespacedAIHelperKey(key));
}

export function getOrCreateAISessionId(ownerId?: string): string {
  if (!isAIHelperStorageOwnerId(ownerId)) {
    return crypto.randomUUID();
  }

  const key = aiHelperStorageKeys(ownerId).sessionId;
  const stored = localStorage.getItem(key);
  if (stored) {
    return stored;
  }

  const newSessionId = crypto.randomUUID();
  localStorage.setItem(key, newSessionId);
  return newSessionId;
}

export function rotateAIHelperSessionId(ownerId?: string): string {
  const newSessionId = crypto.randomUUID();
  if (!isAIHelperStorageOwnerId(ownerId)) {
    return newSessionId;
  }

  localStorage.setItem(aiHelperStorageKeys(ownerId).sessionId, newSessionId);
  return newSessionId;
}
