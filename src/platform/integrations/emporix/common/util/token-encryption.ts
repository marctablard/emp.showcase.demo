import crypto from 'crypto';
import 'server-only';

const ENCRYPTED_PREFIX = 'enc.v1:';
const HKDF_SALT = 'emporix-token-enc-v1';
const HKDF_INFO = 'aes-256-gcm-cookie';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Derives a 256-bit AES key from the given secret using HKDF (SHA-256).
 */
export function deriveKey(secret: string): Buffer {
  if (!secret) {
    throw new Error('Token encryption secret must not be empty');
  }
  return Buffer.from(crypto.hkdfSync('sha256', secret, HKDF_SALT, HKDF_INFO, 32));
}

/**
 * Encrypts a plaintext string using AES-256-GCM with a random IV.
 * Returns a prefixed base64url string: "enc.v1:<base64url(iv + ciphertext + authTag)>"
 */
export function encryptTokenPayload(plaintext: string, secret: string): string {
  const key = deriveKey(secret);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const payload = Buffer.concat([iv, encrypted, authTag]);
  return ENCRYPTED_PREFIX + payload.toString('base64url');
}

/**
 * Decrypts a value produced by `encryptTokenPayload`.
 * Expects input in the format "enc.v1:<base64url(iv + ciphertext + authTag)>".
 */
export function decryptTokenPayload(encrypted: string, secret: string): string {
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('Invalid encrypted format: missing prefix');
  }
  const key = deriveKey(secret);
  const payload = Buffer.from(encrypted.slice(ENCRYPTED_PREFIX.length), 'base64url');
  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const ciphertext = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Checks whether a value uses the encrypted format (starts with "enc.v1:").
 */
export function isEncryptedFormat(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Attempts to decrypt if the value is in encrypted format, otherwise falls back
 * to base64 decoding (legacy cookie format).
 */
export function decryptOrDecodeLegacy(value: string, secret: string): string {
  if (isEncryptedFormat(value)) {
    return decryptTokenPayload(value, secret);
  }
  // Legacy base64-encoded JSON
  return Buffer.from(value, 'base64').toString('utf-8');
}
