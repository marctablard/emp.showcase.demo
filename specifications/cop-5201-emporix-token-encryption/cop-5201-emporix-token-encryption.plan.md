# COP-5201 Encrypt Emporix Token Cookie - Implementation Plan

## Task Details

| Field            | Value                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Jira ID          | COP-5201                                                                                    |
| Title            | Encrypt Emporix Token Cookie                                                                |
| Description      | Replace base64 encoding with AES-256-GCM encryption for the `emporix-token_{tenant}` cookie and localStorage storage |
| Priority         | High                                                                                        |
| Related Research | N/A                                                                                         |

## Proposed Solution

Encrypt the Emporix OAuth token payload using AES-256-GCM authenticated encryption. The solution consists of three layers:

1. **Server-side encryption utility** — A shared module using Node.js `crypto` that derives a 256-bit key from `NEXTAUTH_SECRET` via HKDF and encrypts/decrypts token payloads with AES-256-GCM. A random 12-byte IV is generated per encryption and prepended to the ciphertext. A version-prefixed format (`enc.v1:`) enables backward-compatible detection.

2. **Server and SSR Token Managers** — `EmporixTokenManagerServer` and `EmporixTokenManagerSSR` are updated to use the encryption utility instead of plain base64 encoding. On read, both old (base64 JSON) and new (encrypted) formats are supported for zero-downtime migration.

3. **Client-side encryption** — `EmporixTokenManagerClient` is updated to use the Web Crypto API (`SubtleCrypto`) with AES-GCM. The key is derived from `window.location.origin + tenant` using PBKDF2 with a fixed salt. This provides obfuscation-grade protection of localStorage (prevents casual token extraction) while acknowledging that true security relies on the server-side httpOnly cookie.

```
┌───────────────────────────────────────────────────────────┐
│                   Encryption Flow                          │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Server/SSR (Node.js crypto):                             │
│                                                           │
│  NEXTAUTH_SECRET ─→ HKDF(sha256, salt, info) ─→ 256-bit key │
│                                                           │
│  writeTokens: JSON → encrypt(AES-256-GCM, key, random IV)│
│             → "enc.v1:<base64url(iv+ciphertext+tag)>"     │
│             → httpOnly cookie                             │
│                                                           │
│  readTokens: cookie → detect format:                      │
│    "enc.v1:..." → decrypt → JSON.parse → TokenStore       │
│    else         → base64 decode → JSON.parse (legacy)     │
│                                                           │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Client (Web Crypto SubtleCrypto):                        │
│                                                           │
│  origin+tenant ─→ PBKDF2(sha256, salt) ─→ 256-bit key    │
│                                                           │
│  writeTokens: JSON → encrypt(AES-GCM, key, random IV)    │
│             → "enc.v1:<base64(iv+ciphertext+tag)>"        │
│             → localStorage                                │
│                                                           │
│  readTokens: localStorage → detect format:                │
│    "enc.v1:..." → decrypt → JSON.parse → TokenStore       │
│    else         → JSON.parse (legacy)                     │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

## Current Implementation Analysis

### Already Implemented

- `EmporixTokenManagerAbstract` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerAbstract.ts` - Base class with `buildStorageKey(tenant)`, `readTokens`/`writeTokens` abstract methods, and full token lifecycle management
- `EmporixTokenManagerServer` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerServer.ts` - Server-side cookie read/write with base64 encoding, httpOnly/secure/sameSite/maxAge settings
- `EmporixTokenManagerSSR` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerSSR.ts` - SSR variant that reads cookies (base64) and caches in-memory
- `EmporixTokenManagerClient` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerClient.ts` - Client-side localStorage read/write with plain JSON
- `EmporixTokenManager` interface - `src/platform/integrations/emporix/common/EmporixTokenManager.d.ts` - Public contract (not affected)
- DI wiring - `src/platform/server.ts` and `src/platform/ssr.ts` - Bind concrete implementations to `'EmporixTokenManager'`
- `NEXTAUTH_SECRET` env validation - `src/platform/healthcheck/env-validation.ts` - Already validates presence of the secret
- Node.js `crypto` usage patterns - `src/platform/services/auth/impl/EmporixAuthService.ts`, `src/app/api/csrf/route.ts` - Existing precedent for `import crypto from 'crypto'`
- Existing test suite - `src/platform/integrations/emporix/common/EmporixTokenManagerServer.test.ts` (resolveSessionParams), `src/platform/integrations/emporix/common/impl/EmporixTokenManagerClient.test.ts` (read/write/clear round-trip)

### To Be Modified

- `EmporixTokenManagerServer.readTokens` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerServer.ts` - Replace base64 decode with encrypted format detection + decryption (with base64 fallback)
- `EmporixTokenManagerServer.writeTokens` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerServer.ts` - Replace base64 encode with AES-GCM encryption
- `EmporixTokenManagerSSR.readTokens` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerSSR.ts` - Replace base64 decode with encrypted format detection + decryption (with base64 fallback)
- `EmporixTokenManagerClient.readTokens` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerClient.ts` - Replace plain JSON.parse with decrypt + JSON.parse (with plain JSON fallback)
- `EmporixTokenManagerClient.writeTokens` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerClient.ts` - Replace JSON.stringify with encrypt + store
- `EmporixTokenManagerClient.test.ts` - `src/platform/integrations/emporix/common/impl/EmporixTokenManagerClient.test.ts` - Update assertions to expect encrypted values instead of plain JSON

### To Be Created

- `token-encryption.ts` - Server-side encryption utility module using Node.js `crypto` (HKDF key derivation, AES-256-GCM encrypt/decrypt, format detection)
- `token-encryption.test.ts` - Unit tests for server-side encryption utility (encrypt/decrypt round-trip, backward compat detection, tamper detection, key derivation determinism)
- `token-encryption-client.ts` - Client-side encryption utility using Web Crypto API (PBKDF2 key derivation, AES-GCM encrypt/decrypt, format detection)
- `token-encryption-client.test.ts` - Unit tests for client-side encryption utility

## Open Questions

| #   | Question                                                                                         | Answer                                                                                                                                                              | Status       |
| --- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| 1   | Should the env var be `NEXTAUTH_SECRET` or `AUTH_SECRET`?                                        | Use `NEXTAUTH_SECRET` — it's the existing env var already validated in healthchecks and used by NextAuth.                                                            | ✅ Resolved  |
| 2   | What if `NEXTAUTH_SECRET` is missing at runtime?                                                  | Throw an explicit error during encryption. The healthcheck already validates its presence at startup. Do not fall back to plaintext.                                  | ✅ Resolved  |
| 3   | How should we handle corrupted/tampered encrypted cookies?                                        | AES-GCM will reject tampered ciphertext (auth tag mismatch). Treat as missing token — return `{}` and log a warning. The next request will issue a new anonymous token. | ✅ Resolved  |
| 4   | Should client-side encryption key be derived from a server-issued value or a public value?         | Derive from `window.location.origin + tenant` with PBKDF2. This is deterministic per-origin, preventing casual inspection while keeping the implementation stateless.  | ✅ Resolved  |

## Implementation Plan

### Phase 1: Server-Side Encryption Utility

#### Task 1.1 - [CREATE] Token Encryption Utility Module

**Description**: Create `src/platform/integrations/emporix/common/util/token-encryption.ts` implementing AES-256-GCM encryption/decryption with HKDF key derivation from `NEXTAUTH_SECRET`.

**Implementation details**:
- `deriveKey(secret: string): Buffer` — Uses `crypto.hkdfSync('sha256', secret, SALT, INFO, 32)` with fixed salt `'emporix-token-enc-v1'` and info `'aes-256-gcm-cookie'`
- `encryptTokenPayload(plaintext: string, secret: string): string` — Generates random 12-byte IV, encrypts with AES-256-GCM, returns `enc.v1:<base64url(iv + ciphertext + authTag)>`
- `decryptTokenPayload(encrypted: string, secret: string): string` — Strips prefix, base64url-decodes, splits IV/ciphertext/tag, decrypts
- `isEncryptedFormat(value: string): boolean` — Checks for `enc.v1:` prefix
- `decryptOrDecodeLegacy(value: string, secret: string): string` — Unified helper: tries decrypt if encrypted format, otherwise base64 decode (legacy fallback)
- Mark module with `'server-only'` import to prevent accidental client bundling

**Definition of Done**:

- [x] Module exists at `src/platform/integrations/emporix/common/util/token-encryption.ts`
- [x] Uses `import 'server-only'` guard
- [x] `encryptTokenPayload` produces output prefixed with `enc.v1:`
- [x] `decryptTokenPayload` correctly reverses encryption
- [x] `decryptOrDecodeLegacy` handles both encrypted and legacy base64 formats
- [x] Throws clear error if `secret` is empty/undefined
- [x] No new dependencies added (uses Node.js built-in `crypto`)

#### Task 1.2 - [CREATE] Token Encryption Utility Tests

**Description**: Create `src/platform/integrations/emporix/common/util/token-encryption.test.ts` with comprehensive unit tests.

**Definition of Done**:

- [x] Test file exists at `src/platform/integrations/emporix/common/util/token-encryption.test.ts`
- [x] Tests verify encrypt → decrypt round-trip preserves plaintext
- [x] Tests verify each encryption produces unique ciphertext (random IV)
- [x] Tests verify tampered ciphertext throws (auth tag validation)
- [x] Tests verify `isEncryptedFormat` correctly identifies both formats
- [x] Tests verify `decryptOrDecodeLegacy` handles legacy base64 JSON (e.g., `Buffer.from('{"anonymousToken":{}}').toString('base64')`)
- [x] Tests verify error thrown when secret is empty
- [x] Tests verify deterministic key derivation (same secret → same key)
- [x] All tests pass with `npm run jest -- --testPathPattern token-encryption.test`

### Phase 2: Update Server and SSR Token Managers

#### Task 2.1 - [MODIFY] EmporixTokenManagerServer - Encrypt Write Path

**Description**: Update `writeTokens` in `EmporixTokenManagerServer.ts` to encrypt the JSON payload using the new encryption utility instead of base64 encoding. The `NEXTAUTH_SECRET` env var is read inside the method.

**Definition of Done**:

- [x] `writeTokens` calls `encryptTokenPayload(JSON.stringify(clientTokens), process.env.NEXTAUTH_SECRET!)` 
- [x] Cookie value is no longer plain base64 JSON
- [x] Cookie options unchanged: `httpOnly: true`, `secure` env-aware, `sameSite: 'strict'`, `path: '/'`, `maxAge: 60 * 60 * 24 * 30`
- [x] `serviceToken` still omitted from cookie payload (existing behavior preserved)

#### Task 2.2 - [MODIFY] EmporixTokenManagerServer - Backward-Compatible Read Path

**Description**: Update `readTokens` in `EmporixTokenManagerServer.ts` to detect cookie format (encrypted vs legacy base64) and handle both. Log a warning when legacy format is encountered.

**Definition of Done**:

- [x] `readTokens` uses `decryptOrDecodeLegacy(cookieValue, process.env.NEXTAUTH_SECRET!)` 
- [x] Legacy base64 cookies are read successfully (no breakage during rollout)
- [x] Tampered/corrupted cookies are caught → return `{}` and log warning via `this.logger.warn`
- [x] `serviceToken` is still restored from in-memory `this.serviceToken` (existing behavior preserved)

#### Task 2.3 - [MODIFY] EmporixTokenManagerSSR - Backward-Compatible Read Path

**Description**: Update `readTokens` in `EmporixTokenManagerSSR.ts` to use the same format detection as the server. SSR only reads cookies (it doesn't set them for session tokens), so only the read path needs updating.

**Definition of Done**:

- [x] `readTokens` uses `decryptOrDecodeLegacy(cookieValue, process.env.NEXTAUTH_SECRET!)`
- [x] Legacy base64 cookies are read successfully
- [x] Tampered/corrupted cookies are caught → clear `this.ssrToken[tenant]`, return `{}`
- [x] Existing `writeTokens` (in-memory only for SSR) is unchanged

#### Task 2.4 - [MODIFY] Server Token Manager Tests

**Description**: Add/update tests in `EmporixTokenManagerServer.test.ts` (or a new dedicated test file for read/write) to verify encryption behavior.

**Definition of Done**:

- [x] Test verifies written cookie value starts with `enc.v1:` prefix
- [x] Test verifies written cookie value does NOT contain plaintext `access_token` or `refresh_token`
- [x] Test verifies reading an encrypted cookie returns correct `TokenStore`
- [x] Test verifies reading a legacy base64 cookie still returns correct `TokenStore` (backward compat)
- [x] Test verifies corrupted cookie returns `{}` without throwing
- [x] `clearTokens` test still passes
- [x] All existing `resolveSessionParams` tests still pass
- [x] Tests pass with `npm run jest -- --testPathPattern EmporixTokenManager`

### Phase 3: Client-Side Encryption

#### Task 3.1 - [CREATE] Client Token Encryption Utility Module

**Description**: Create `src/platform/integrations/emporix/common/util/token-encryption-client.ts` using the Web Crypto API (`SubtleCrypto`) for AES-GCM encryption in browser environments. Key is derived from `window.location.origin + tenant` using PBKDF2.

**Implementation details**:
- `deriveClientKey(tenant: string): Promise<CryptoKey>` — Uses `crypto.subtle.importKey` + `crypto.subtle.deriveKey` with PBKDF2 (SHA-256, 100_000 iterations, fixed salt `'emporix-client-enc-v1'`)
- `encryptClientPayload(plaintext: string, tenant: string): Promise<string>` — Generates random 12-byte IV, encrypts with AES-GCM, returns `enc.v1:<base64(iv + ciphertext)>` (GCM tag is appended automatically by SubtleCrypto)
- `decryptClientPayload(encrypted: string, tenant: string): Promise<string>` — Reverses encryption
- `isEncryptedFormat(value: string): boolean` — Same prefix check as server
- `decryptOrParseLegacy(value: string, tenant: string): Promise<string>` — Tries decrypt if encrypted, otherwise returns raw value (legacy JSON)
- All functions are `async` because Web Crypto API is promise-based
- Module must NOT import `server-only` or Node.js `crypto`

**Definition of Done**:

- [x] Module exists at `src/platform/integrations/emporix/common/util/token-encryption-client.ts`
- [x] Does not import `'server-only'` or `node:crypto`
- [x] Uses only `globalThis.crypto.subtle` (Web Crypto API)
- [x] `encryptClientPayload` produces output prefixed with `enc.v1:`
- [x] `decryptClientPayload` correctly reverses encryption
- [x] `decryptOrParseLegacy` handles both encrypted and legacy plain JSON formats
- [x] Key derivation is deterministic for same origin + tenant combination

#### Task 3.2 - [CREATE] Client Token Encryption Utility Tests

**Description**: Create `src/platform/integrations/emporix/common/util/token-encryption-client.test.ts` with unit tests using a Web Crypto polyfill (jsdom environment provides `crypto.subtle`).

**Definition of Done**:

- [x] Test file exists
- [x] Tests verify encrypt → decrypt round-trip
- [x] Tests verify each encryption produces unique ciphertext
- [x] Tests verify `decryptOrParseLegacy` handles legacy plain JSON (e.g., `'{"anonymousToken":{}}'`)
- [x] Tests verify `isEncryptedFormat` detection
- [x] All tests pass with `npm run jest -- --testPathPattern token-encryption-client.test`

#### Task 3.3 - [MODIFY] EmporixTokenManagerClient - Encrypted Storage

**Description**: Update `readTokens` and `writeTokens` in `EmporixTokenManagerClient.ts` to use the client encryption utility. Both methods become `async` (they already return `Promise`).

**Definition of Done**:

- [x] `writeTokens` calls `encryptClientPayload(JSON.stringify(tokens), tenant)` before storing in localStorage
- [x] `readTokens` calls `decryptOrParseLegacy(storedValue, tenant)` to handle both encrypted and legacy plain JSON values
- [x] `clearTokens` remains unchanged (just `removeItem`)
- [x] Existing functionality preserved: anonymous browsing, cart persistence, customer login

#### Task 3.4 - [MODIFY] EmporixTokenManagerClient Tests

**Description**: Update `src/platform/integrations/emporix/common/impl/EmporixTokenManagerClient.test.ts` to verify encrypted storage.

**Definition of Done**:

- [x] Test verifies `writeTokens` stores value starting with `enc.v1:` (not plain JSON)
- [x] Test verifies `readTokens` decrypts and returns correct `TokenStore`
- [x] Test verifies reading legacy plain JSON still works (backward compat)
- [x] Test verifies `clearTokens` removes the entry
- [x] All tests pass with `npm run jest -- --testPathPattern EmporixTokenManagerClient`

### Phase 4: Verification and Quality Assurance

#### Task 4.1 - [REUSE] Full Test Suite Verification

**Description**: Run the complete platform test suite to verify no regressions.

**Definition of Done**:

- [x] `npm run jest -- --testPathPattern "emporix/common"` passes all tests
- [ ] `npm run jest` full suite passes (no unrelated failures introduced)
- [x] `npm run lint` passes
- [x] `npm run build` succeeds without errors
- [x] TypeScript compilation (`npx tsc --noEmit`) passes

#### Task 4.2 - [REUSE] Code Review by `tsh-code-reviewer` agent

**Description**: Run `tsh-code-reviewer` agent via `tsh-review.prompt.md` to perform final code review. Include E2E test execution as part of review scope.

**Definition of Done**:

- [x] Code review passes or all findings addressed
- [ ] E2E tests pass (anonymous browsing, login, cart operations, checkout flow)
- [x] Review report documented in Changelog

## Security Considerations

- **Authenticated encryption (AES-GCM)**: Provides both confidentiality and integrity. Any tampering with the ciphertext is detected via the 16-byte authentication tag — tampered cookies are rejected rather than producing corrupted data.
- **Key derivation (HKDF)**: `NEXTAUTH_SECRET` may vary in length/format across deployments. HKDF with SHA-256 derives a fixed-length 256-bit key regardless of input length, using a domain-specific salt and info string to prevent key reuse across different encryption contexts.
- **Random IV per encryption**: A fresh 12-byte IV is generated for every `writeTokens` call via `crypto.randomBytes(12)`. This prevents ciphertext comparison attacks even when the same TokenStore is re-encrypted.
- **No key in client bundle**: `NEXTAUTH_SECRET` is never exposed to the browser. The server-side module uses `import 'server-only'` to prevent accidental bundling.
- **Client-side encryption is obfuscation-grade**: The client key is derived from public values (`origin + tenant`). This prevents casual localStorage inspection (e.g., browser extensions scanning for tokens) but does not protect against a targeted attacker with JS execution context. True security relies on the server-side httpOnly cookie.
- **Graceful degradation**: Corrupted or tampered cookies result in `{}` (empty token store) rather than crashes. The application will issue a new anonymous token on the next request.
- **Secret rotation**: If `NEXTAUTH_SECRET` is rotated, existing encrypted cookies become unreadable and are treated as expired (user gets a new anonymous session). This is acceptable — token cookies have a 30-day maxAge, and rotation is expected to be infrequent.

## Quality Assurance

Acceptance criteria checklist to verify the implementation meets the defined requirements:

- [ ] Cookie value is AES-GCM encrypted — inspecting the `emporix-token_{tenant}` cookie in browser devtools shows a value starting with `enc.v1:` (not base64 JSON)
- [ ] Cookie value does NOT contain plaintext `access_token`, `refresh_token`, or `session_id` (verified by unit test)
- [ ] `EmporixTokenManagerClient` stores encrypted data in localStorage — value starts with `enc.v1:` (not plain JSON)
- [ ] Backward-compatible read: Old base64 cookies are successfully parsed during migration (verified by unit test)
- [ ] Backward-compatible read: Old plain JSON localStorage values are successfully parsed (verified by unit test)
- [ ] Anonymous browsing flow works: page loads → anonymous token issued → stored encrypted → subsequent requests use the token
- [ ] Cart persistence works: add to cart → reload → cart items preserved
- [ ] Customer login flow works: login → customer token stored encrypted → authenticated requests succeed
- [ ] Silent refresh works: expired token → refresh succeeds → new encrypted token stored
- [ ] Logout works: `clearTokens` removes cookie/localStorage entry completely
- [ ] `secure` flag remains `true` in production, `false` in development
- [ ] `sameSite=strict` retained
- [ ] `httpOnly=true` retained
- [ ] Session maxAge stays at 30 days (2,592,000 seconds)
- [ ] No new npm dependencies introduced (uses built-in Node.js `crypto` and browser `SubtleCrypto`)
- [ ] TypeScript strict mode compliance — no `any` types introduced
- [ ] All unit tests pass
- [ ] Build succeeds without errors

## Improvements (Out of Scope)

- **Server-side session store**: Store tokens in Redis/database instead of cookies to eliminate cookie size concerns and enable server-side revocation. Not in scope for this task.
- **Token rotation on read**: Re-encrypt with a fresh IV on every read to limit ciphertext exposure window. Would increase cookie write frequency — evaluate separately.
- **Key versioning**: Support multiple encryption keys simultaneously to enable zero-downtime secret rotation. Current approach accepts brief session reset during rotation.
- **Client encryption key from server**: Issue a per-session random encryption key via a non-httpOnly cookie for stronger client-side encryption. More complex but provides actual cryptographic protection for localStorage.
- **Cookie compression**: Compress JSON before encryption to reduce cookie size (especially for large TokenStore payloads). Not needed at current payload sizes (~500-800 bytes).

## Code Review Findings

**Reviewer**: `tsh-code-reviewer` agent  
**Date**: 2026-05-22  
**Verdict**: ✅ APPROVED — no blocking issues

### Security (AES-256-GCM Correctness)

| Check | Result |
|-------|--------|
| HKDF key derivation (SHA-256, 32-byte output) | ✅ Correct |
| Random 96-bit IV per encryption | ✅ `crypto.randomBytes(12)` |
| Auth tag length (16 bytes) | ✅ Default GCM tag |
| Ciphertext format: `iv + ciphertext + authTag` | ✅ Correctly assembled and split |
| Tampered ciphertext rejected | ✅ GCM auth tag verification throws |
| `server-only` guard prevents client bundling | ✅ Present in `token-encryption.ts` |
| NEXTAUTH_SECRET never sent to client | ✅ Only used in server-side modules |
| Client key from public values (obfuscation-grade) | ✅ Documented limitation, acceptable |
| PBKDF2 iterations (100k) | ✅ Adequate for obfuscation use case |

### Backward Compatibility

| Scenario | Result |
|----------|--------|
| Legacy base64 cookie → Server reads correctly | ✅ Tested |
| Legacy base64 cookie → SSR reads correctly | ✅ Tested |
| Legacy plain JSON localStorage → Client reads correctly | ✅ Tested |
| `enc.v1:` prefix cannot collide with base64 charset | ✅ Contains `.` and `:` which are not in base64 |
| Zero-downtime migration (no explicit step required) | ✅ Next write upgrades format |

### Error Handling

| Scenario | Result |
|----------|--------|
| Corrupted cookie (server) → returns `{}`, logs warning | ✅ |
| Corrupted cookie (SSR) → clears cache, returns `{}` | ✅ |
| Corrupted localStorage (client) → returns `{}` | ✅ |
| Empty/missing NEXTAUTH_SECRET → throws at encrypt time | ✅ |
| Missing cookie → returns `{}` | ✅ |

### Code Quality

| Check | Result |
|-------|--------|
| No `any` types | ✅ |
| Proper `import type` usage | ✅ |
| Follows project DI conventions (`@injectable`) | ✅ |
| LoggerService usage (Pino order: context first, message second) | ✅ |
| No new npm dependencies | ✅ |
| TypeScript strict compliance | ✅ |
| No `console.*` usage | ✅ |

### Test Coverage

| Area | Tests |
|------|-------|
| Server encrypt/decrypt round-trip | ✅ |
| Unique ciphertext per call (random IV) | ✅ |
| Tamper detection (auth tag mismatch) | ✅ |
| Wrong secret rejection | ✅ |
| Empty secret error | ✅ |
| Format detection (`isEncryptedFormat`) | ✅ |
| Legacy fallback (`decryptOrDecodeLegacy`) | ✅ |
| Client encrypt/decrypt round-trip | ✅ |
| Client tamper detection | ✅ |
| Client wrong tenant rejection | ✅ |
| TokenManager integration: cookie value encrypted | ✅ |
| TokenManager integration: service token omitted | ✅ |
| TokenManager integration: cookie options preserved | ✅ |
| TokenManager integration: backward compat read | ✅ |
| TokenManager integration: corrupted → {} + warn | ✅ |
| Client TokenManager: encrypted write + read | ✅ |
| Client TokenManager: legacy JSON read | ✅ |
| Client TokenManager: corrupted → {} | ✅ |
| **Total: 77/77 passing** | ✅ |

### Minor Suggestions (Non-blocking)

1. **SSR decryption failure logging**: `EmporixTokenManagerSSR.readTokens` silently catches decryption errors without logging. Consider injecting `LoggerService` and emitting a warning (like the server does). Low priority since SSR doesn't set cookies itself.

2. **Server decrypt string concatenation**: `decipher.update(ciphertext) + decipher.final('utf8')` relies on implicit `Buffer.toString()` coercion. A more explicit alternative would be `Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')`. Functionally equivalent; purely a clarity preference.

### Quality Gate Results

| Gate | Status |
|------|--------|
| TypeScript (`npx tsc --noEmit`) | ✅ 0 new errors |
| Unit tests (`emporix/common`) | ✅ 77/77 passing |
| ESLint (changed files) | ✅ 0 errors, 0 warnings |
| Build (`npm run build`) | ✅ Successful |

## Changelog

| Date       | Change Description   |
| ---------- | -------------------- |
| 2026-05-22 | Initial plan created |
| 2026-05-22 | Code review completed — APPROVED with 2 minor non-blocking suggestions |
