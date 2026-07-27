import {
  decryptOrDecodeLegacy,
  decryptTokenPayload,
  deriveKey,
  encryptTokenPayload,
  isEncryptedFormat,
} from './token-encryption';

const TEST_SECRET = 'test-secret-for-unit-tests-must-be-long-enough';

describe('token-encryption', () => {
  describe('deriveKey', () => {
    it('should derive a 32-byte key from a secret', () => {
      const key = deriveKey(TEST_SECRET);
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });

    it('should derive the same key for the same secret (deterministic)', () => {
      const key1 = deriveKey(TEST_SECRET);
      const key2 = deriveKey(TEST_SECRET);
      expect(key1.equals(key2)).toBe(true);
    });

    it('should derive different keys for different secrets', () => {
      const key1 = deriveKey('secret-a');
      const key2 = deriveKey('secret-b');
      expect(key1.equals(key2)).toBe(false);
    });

    it('should throw when secret is empty', () => {
      expect(() => deriveKey('')).toThrow('Token encryption secret must not be empty');
    });
  });

  describe('encryptTokenPayload / decryptTokenPayload', () => {
    it('should produce output with enc.v1: prefix', () => {
      const result = encryptTokenPayload('hello', TEST_SECRET);
      expect(result.startsWith('enc.v1:')).toBe(true);
    });

    it('should encrypt and decrypt round-trip successfully', () => {
      const plaintext = JSON.stringify({ anonymousToken: { token: { access_token: 'abc123' } } });
      const encrypted = encryptTokenPayload(plaintext, TEST_SECRET);
      const decrypted = decryptTokenPayload(encrypted, TEST_SECRET);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce unique ciphertext for each call (random IV)', () => {
      const plaintext = 'same-content';
      const encrypted1 = encryptTokenPayload(plaintext, TEST_SECRET);
      const encrypted2 = encryptTokenPayload(plaintext, TEST_SECRET);
      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should reject tampered ciphertext (auth tag validation)', () => {
      const encrypted = encryptTokenPayload('sensitive-data', TEST_SECRET);
      // Tamper with one character in the base64url payload
      const prefix = 'enc.v1:';
      const payload = encrypted.slice(prefix.length);
      const chars = payload.split('');
      // Flip a character in the middle of the ciphertext
      const idx = Math.floor(chars.length / 2);
      chars[idx] = chars[idx] === 'A' ? 'B' : 'A';
      const tampered = prefix + chars.join('');
      expect(() => decryptTokenPayload(tampered, TEST_SECRET)).toThrow();
    });

    it('should throw when decrypting with wrong secret', () => {
      const encrypted = encryptTokenPayload('data', TEST_SECRET);
      expect(() => decryptTokenPayload(encrypted, 'wrong-secret')).toThrow();
    });

    it('should throw when input lacks prefix', () => {
      expect(() => decryptTokenPayload('no-prefix-here', TEST_SECRET)).toThrow('missing prefix');
    });

    it('should throw when secret is empty during encryption', () => {
      expect(() => encryptTokenPayload('data', '')).toThrow('Token encryption secret must not be empty');
    });
  });

  describe('isEncryptedFormat', () => {
    it('should return true for encrypted format', () => {
      expect(isEncryptedFormat('enc.v1:somedata')).toBe(true);
    });

    it('should return false for base64 format', () => {
      const b64 = Buffer.from('{"anonymousToken":{}}').toString('base64');
      expect(isEncryptedFormat(b64)).toBe(false);
    });

    it('should return false for plain JSON', () => {
      expect(isEncryptedFormat('{"key":"value"}')).toBe(false);
    });
  });

  describe('decryptOrDecodeLegacy', () => {
    it('should decrypt encrypted format', () => {
      const plaintext = '{"anonymousToken":{"token":{"access_token":"xyz"}}}';
      const encrypted = encryptTokenPayload(plaintext, TEST_SECRET);
      const result = decryptOrDecodeLegacy(encrypted, TEST_SECRET);
      expect(result).toBe(plaintext);
    });

    it('should decode legacy base64 format', () => {
      const json = '{"anonymousToken":{}}';
      const b64 = Buffer.from(json).toString('base64');
      const result = decryptOrDecodeLegacy(b64, TEST_SECRET);
      expect(result).toBe(json);
    });

    it('should handle legacy base64 with full token structure', () => {
      const tokenData = {
        anonymousToken: {
          token: { access_token: 'legacy-token', session_id: 'sid-1' },
          expiryAt: 9999999999999,
        },
      };
      const b64 = Buffer.from(JSON.stringify(tokenData)).toString('base64');
      const result = decryptOrDecodeLegacy(b64, TEST_SECRET);
      expect(JSON.parse(result)).toEqual(tokenData);
    });
  });
});
