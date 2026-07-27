import { webcrypto } from 'crypto';
import {
  decryptClientPayload,
  decryptOrParseLegacy,
  encryptClientPayload,
  isEncryptedFormat,
} from './token-encryption-client';

// Polyfill Web Crypto API and browser globals for Node.js test environment
beforeAll(() => {
  Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: true });
  Object.defineProperty(globalThis, 'location', { value: { origin: 'https://shop.example.com' }, writable: true });
});

const TEST_TENANT = 'test-tenant';

describe('token-encryption-client', () => {
  describe('encryptClientPayload / decryptClientPayload', () => {
    it('should produce output with enc.v1: prefix', async () => {
      const result = await encryptClientPayload('hello', TEST_TENANT);
      expect(result.startsWith('enc.v1:')).toBe(true);
    });

    it('should encrypt and decrypt round-trip successfully', async () => {
      const plaintext = JSON.stringify({ anonymousToken: { token: { access_token: 'client-tok' } } });
      const encrypted = await encryptClientPayload(plaintext, TEST_TENANT);
      const decrypted = await decryptClientPayload(encrypted, TEST_TENANT);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce unique ciphertext for each call (random IV)', async () => {
      const plaintext = 'same-content';
      const encrypted1 = await encryptClientPayload(plaintext, TEST_TENANT);
      const encrypted2 = await encryptClientPayload(plaintext, TEST_TENANT);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should reject tampered ciphertext', async () => {
      const encrypted = await encryptClientPayload('sensitive', TEST_TENANT);
      const prefix = 'enc.v1:';
      const payload = encrypted.slice(prefix.length);
      // Tamper with one character
      const chars = payload.split('');
      const idx = Math.floor(chars.length / 2);
      chars[idx] = chars[idx] === 'A' ? 'B' : 'A';
      const tampered = prefix + chars.join('');
      await expect(decryptClientPayload(tampered, TEST_TENANT)).rejects.toThrow();
    });

    it('should reject decryption with wrong tenant', async () => {
      const encrypted = await encryptClientPayload('data', TEST_TENANT);
      await expect(decryptClientPayload(encrypted, 'wrong-tenant')).rejects.toThrow();
    });

    it('should throw when input lacks prefix', async () => {
      await expect(decryptClientPayload('no-prefix-here', TEST_TENANT)).rejects.toThrow('missing prefix');
    });
  });

  describe('isEncryptedFormat', () => {
    it('should return true for encrypted format', () => {
      expect(isEncryptedFormat('enc.v1:somedata')).toBe(true);
    });

    it('should return false for plain JSON', () => {
      expect(isEncryptedFormat('{"anonymousToken":{}}')).toBe(false);
    });
  });

  describe('decryptOrParseLegacy', () => {
    it('should decrypt encrypted format', async () => {
      const plaintext = '{"anonymousToken":{}}';
      const encrypted = await encryptClientPayload(plaintext, TEST_TENANT);
      const result = await decryptOrParseLegacy(encrypted, TEST_TENANT);
      expect(result).toBe(plaintext);
    });

    it('should return plain JSON as-is for legacy format', async () => {
      const json = '{"anonymousToken":{"token":{"access_token":"legacy"}}}';
      const result = await decryptOrParseLegacy(json, TEST_TENANT);
      expect(result).toBe(json);
    });
  });
});
