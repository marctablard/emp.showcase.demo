/**
 * @jest-environment jsdom
 */
import { CUSTOMER_ID } from '@/lib/common/customer-identity';
import { clearAllPersistedStores } from '@/utils/storeUtils';
import {
  LEGACY_AI_HELPER_STORAGE_KEYS,
  adoptAIHelperStorage,
  aiHelperStorageKeys,
  clearAIHelperClientState,
  clearUnscopedAIHelperStorage,
  getOrCreateAISessionId,
  rotateAIHelperSessionId,
} from './ai-helper-storage';

describe('ai-helper-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('namespaces conversation keys by authenticated customer id', () => {
    expect(aiHelperStorageKeys('cust-a')).toEqual({
      sessionId: 'ai-helper.v1:cust-a:sessionId',
      messages: 'ai-helper.v1:cust-a:messages',
      chatMode: 'ai-helper.v1:cust-a:chatMode',
    });
  });

  it('reuses a stored conversation id for the same shopper', () => {
    const first = getOrCreateAISessionId('cust-a');
    expect(getOrCreateAISessionId('cust-a')).toBe(first);
    expect(localStorage.getItem(aiHelperStorageKeys('cust-a').sessionId)).toBe(first);
  });

  it('does not persist a conversation id without an authenticated owner', () => {
    const ephemeral = getOrCreateAISessionId(CUSTOMER_ID.SESSION_ANONYMOUS);
    expect(ephemeral).toBeTruthy();
    expect(localStorage.length).toBe(0);
    expect(getOrCreateAISessionId()).not.toBe(ephemeral);
  });

  it('adopts the current shopper and drops unscoped plus other shoppers’ Helper keys', () => {
    const other = aiHelperStorageKeys('cust-a');
    const current = aiHelperStorageKeys('cust-b');
    localStorage.setItem(LEGACY_AI_HELPER_STORAGE_KEYS.messages, '[{"content":"unscoped"}]');
    localStorage.setItem(LEGACY_AI_HELPER_STORAGE_KEYS.sessionId, 'legacy-session');
    localStorage.setItem(other.messages, '[{"content":"admin orders"}]');
    localStorage.setItem(current.messages, '[{"content":"requestor orders"}]');
    localStorage.setItem('dashboard-storage', '{}');

    adoptAIHelperStorage('cust-b');

    expect(localStorage.getItem(LEGACY_AI_HELPER_STORAGE_KEYS.messages)).toBeNull();
    expect(localStorage.getItem(LEGACY_AI_HELPER_STORAGE_KEYS.sessionId)).toBeNull();
    expect(localStorage.getItem(other.messages)).toBeNull();
    expect(localStorage.getItem(current.messages)).toBe('[{"content":"requestor orders"}]');
    expect(localStorage.getItem('dashboard-storage')).toBe('{}');
  });

  it('clears only unscoped Helper keys', () => {
    const namespaced = aiHelperStorageKeys('cust-a');
    localStorage.setItem(LEGACY_AI_HELPER_STORAGE_KEYS.chatMode, 'true');
    localStorage.setItem(namespaced.messages, '[{"content":"keep"}]');

    clearUnscopedAIHelperStorage();

    expect(localStorage.getItem(LEGACY_AI_HELPER_STORAGE_KEYS.chatMode)).toBeNull();
    expect(localStorage.getItem(namespaced.messages)).toBe('[{"content":"keep"}]');
  });

  it('clearAIHelperClientState removes every Helper key', () => {
    const namespaced = aiHelperStorageKeys('cust-a');
    localStorage.setItem(LEGACY_AI_HELPER_STORAGE_KEYS.sessionId, 'legacy');
    localStorage.setItem(namespaced.sessionId, 'namespaced');

    clearAIHelperClientState();

    expect(localStorage.getItem(LEGACY_AI_HELPER_STORAGE_KEYS.sessionId)).toBeNull();
    expect(localStorage.getItem(namespaced.sessionId)).toBeNull();
  });

  it('issues a new conversation id after rotate for that shopper', () => {
    const previous = getOrCreateAISessionId('cust-a');
    const next = rotateAIHelperSessionId('cust-a');
    expect(next).not.toBe(previous);
    expect(getOrCreateAISessionId('cust-a')).toBe(next);
  });
});

describe('clearAllPersistedStores', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('removes unscoped Frontend Agent keys on logout without deleting other localStorage (COP-6181)', () => {
    const namespaced = aiHelperStorageKeys('cust-a');
    localStorage.setItem(LEGACY_AI_HELPER_STORAGE_KEYS.sessionId, 'session-a');
    localStorage.setItem(LEGACY_AI_HELPER_STORAGE_KEYS.messages, '[{"content":"admin orders"}]');
    localStorage.setItem(namespaced.messages, '[{"content":"keep-for-same-user"}]');
    localStorage.setItem('history-storage', '{}');

    clearAllPersistedStores();

    expect(localStorage.getItem(LEGACY_AI_HELPER_STORAGE_KEYS.sessionId)).toBeNull();
    expect(localStorage.getItem(LEGACY_AI_HELPER_STORAGE_KEYS.messages)).toBeNull();
    expect(localStorage.getItem(namespaced.messages)).toBe('[{"content":"keep-for-same-user"}]');
    expect(localStorage.getItem('history-storage')).toBeNull();
  });
});
