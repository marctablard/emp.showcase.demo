const ENCRYPTED_PREFIX = 'enc.v1:';
const PBKDF2_SALT = 'emporix-client-enc-v1';
const PBKDF2_ITERATIONS = 100_000;
const IV_LENGTH = 12;

/**
 * Derives a 256-bit AES-GCM CryptoKey from the origin + tenant using PBKDF2 (SHA-256).
 */
export async function deriveClientKey(tenant: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(globalThis.location.origin + tenant),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(PBKDF2_SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Encrypts a plaintext string using AES-GCM with a random IV.
 * Returns "enc.v1:<base64(iv + ciphertext+tag)>"
 */
export async function encryptClientPayload(plaintext: string, tenant: string): Promise<string> {
  const key = await deriveClientKey(tenant);
  const encoder = new TextEncoder();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ciphertext = await globalThis.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext));
  // iv + ciphertext (which includes the GCM auth tag appended by SubtleCrypto)
  const payload = new Uint8Array(iv.length + ciphertext.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(ciphertext), iv.length);
  return ENCRYPTED_PREFIX + uint8ToBase64(payload);
}

/**
 * Decrypts a value produced by `encryptClientPayload`.
 */
export async function decryptClientPayload(encrypted: string, tenant: string): Promise<string> {
  if (!encrypted.startsWith(ENCRYPTED_PREFIX)) {
    throw new Error('Invalid encrypted format: missing prefix');
  }
  const key = await deriveClientKey(tenant);
  const payload = base64ToUint8(encrypted.slice(ENCRYPTED_PREFIX.length));
  const iv = payload.slice(0, IV_LENGTH);
  const ciphertext = payload.slice(IV_LENGTH);
  const decrypted = await globalThis.crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
  return new TextDecoder().decode(decrypted);
}

/**
 * Checks whether a value uses the encrypted format (starts with "enc.v1:").
 */
export function isEncryptedFormat(value: string): boolean {
  return value.startsWith(ENCRYPTED_PREFIX);
}

/**
 * Attempts to decrypt if the value is in encrypted format, otherwise returns
 * the raw value as-is (legacy plain JSON).
 */
export async function decryptOrParseLegacy(value: string, tenant: string): Promise<string> {
  if (isEncryptedFormat(value)) {
    return decryptClientPayload(value, tenant);
  }
  return value;
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
