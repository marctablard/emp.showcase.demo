# CMS Webhook Setup

> Operator-facing guide for configuring CMS-side webhooks against the
> Emporix Showcase. Architecture rationale lives in
> [docs/cms-framework.md](./cms-framework.md); this doc covers the
> click-paths in each CMS UI.

## Endpoint

The Showcase exposes a single catch-all webhook endpoint:

```
POST {your-host}/api/cms/webhook
```

There is no per-provider URL — adapter-specific concerns (signature
header, HMAC algorithm, payload shape) are handled inside the active
adapter, selected by `NEXT_CMS_PROVIDER`.

## Secret

The endpoint expects `NEXT_CMS_WEBHOOK_SECRET` to be configured in the
Showcase server environment (server-only, never exposed to the browser):

```bash
# .env.local (production: use your secret store)
NEXT_CMS_WEBHOOK_SECRET=your_random_secret_at_least_32_chars
```

Without the secret the endpoint returns:

```
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{"error":"CMS webhook disabled"}
```

The same secret value must be entered into the CMS-side webhook
configuration so the CMS can compute the matching HMAC signature.

Recommended: 32+ random characters, e.g. `openssl rand -hex 32`.

## Behaviour

| CMS request                                              | Response                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| Active adapter has no webhook surface                    | `405 { error: 'CMS webhook not supported' }`                    |
| Secret missing (server-side)                             | `503 { error: 'CMS webhook disabled' }`                         |
| Signature header missing                                 | `401 { error: 'Invalid webhook signature' }`                    |
| Signature header present but HMAC mismatch               | `401 { error: 'Invalid webhook signature' }`                    |
| Valid signature                                          | `200 { ok: true }` + cache invalidate orchestrated server-side  |
| Adapter throws                                           | `500 { error: 'Failed to handle CMS webhook' }` + log entry     |

Cache invalidation is granular when the adapter can map the payload to
specific `(slug, locale, site)` tuples (Storyblok: yes; the `local`
JSON provider: not applicable — see below). When the adapter cannot map
the payload, the service applies a broad `invalidateAll()` — safe but
coarser.

## CSRF

`src/proxy.ts` exempts exactly `/api/cms/webhook` from CSRF — the HMAC
signature replaces the CSRF token for this machine-to-machine endpoint.

## Provider — Storyblok

### Algorithm

- HMAC-SHA-256 over the raw request body, hex-encoded.
- Header: `webhook-signature` (lower-case; the adapter normalises via
  `Headers.get()`).
- Length guard: provided signature must be 64 hex chars before
  `crypto.timingSafeEqual` is invoked (otherwise the comparison throws).
- Payload: Storyblok's standard `published` / `unpublished` event JSON.

### UI Setup

1. Open your Storyblok space → **Settings → Webhooks**.
2. Click **Add new webhook** (or edit an existing one).
3. **Endpoint URL**: `https://{your-host}/api/cms/webhook`.
4. **Secret**: paste the same value you set in
   `NEXT_CMS_WEBHOOK_SECRET`.
5. **Events**: check at least `Story published` and `Story unpublished`.
   Other events (`released`, `deleted`) are currently mapped to a broad
   cache invalidate.
6. **Activate** the webhook.

### Verification

Trigger a publish in Storyblok. The Showcase server log shows:

```
INFO   CMS webhook handled  { provider: 'storyblok', status: 200 }
```

If the signature is wrong (e.g. mismatched secret) you'll see 401 in
the Storyblok webhook delivery log instead.

### Cache Behaviour for Storyblok Events

| Storyblok payload (excerpt)                                                  | Cache action                                              |
| ---------------------------------------------------------------------------- | --------------------------------------------------------- |
| `{ action: 'published', full_slug: 'home', language: 'en' }`                 | invalidate page `(home, en, …)`                           |
| `{ action: 'published', full_slug: 'main/about', language: 'en' }`           | invalidate page `(about, en, main)`                       |
| `{ action: 'published', full_slug: '_layouts/default', language: 'en' }`    | invalidate layout `(default, en, …)`                      |
| `{ action: 'released', … }`                                                  | broad `invalidateAll()` (mapper returns null)             |
| `{ action: 'published', language: 'default' }`                               | event without locale — facade falls back to env defaults  |

## Provider — Local JSON

The `local` provider (`LocalJsonCmsAdapter`, see
[docs/local-cms.md](./local-cms.md)) serves content from JSON files
under `src/data/cms/`. It does NOT implement the `handleWebhook` SPI
method — there is no upstream content source to be invalidated.

When `NEXT_CMS_PROVIDER=local`, `POST /api/cms/webhook` returns:

```
HTTP/1.1 405 Method Not Allowed
Content-Type: application/json

{"error":"CMS webhook not supported"}
```

Editing a JSON fixture invalidates the bundle on the next build /
reload — no out-of-band webhook is needed.

## Provider — None

The `NullCmsAdapter` omits `handleWebhook` entirely. The facade falls
back to `405 { error: 'CMS webhook not supported' }`. This is the safe
default when no CMS provider is configured — the app boots, the
endpoint exists, but no upstream is wired.

## Adding a New Provider

When implementing webhook support for a new adapter, see
[docs/cms-framework.md](./cms-framework.md) for the SPI contract. Key
invariants:

- `handleWebhook` MUST NOT throw — surface every failure through the
  response envelope.
- HMAC verification MUST use constant-time-compare
  (`crypto.timingSafeEqual`), not `===` or `Buffer.compare`. Apply a
  length guard before `timingSafeEqual` (it throws on length mismatch).
- `mapWebhookPayload` SHOULD return granular events when possible. A
  `null` return triggers a broad-sweep fallback — fine for adapters
  whose payload format the team hasn't fully mapped yet, but coarser
  than per-tuple invalidation.

After implementation, append a provider-specific subsection to this
document (UI screenshot description, header name, algorithm).

## Troubleshooting

### `503 Service Unavailable` on every delivery
- `NEXT_CMS_WEBHOOK_SECRET` is not set on the server. Set it in
  `.env.local` or your production secret store and restart the app.

### `405 Method Not Allowed` on every delivery
- The active provider does not ship a `handleWebhook` (check
  `NEXT_CMS_PROVIDER`). The `local` and `none` providers
  intentionally do not expose webhook support.

### `401 Invalid webhook signature` from a known-good CMS
- The CMS-side secret and the server-side `NEXT_CMS_WEBHOOK_SECRET`
  differ.
- The signature header name doesn't match the adapter's expectation
  (Storyblok adapter uses `webhook-signature`).
- The CMS used a different HMAC algorithm. The Storyblok adapter pins
  HMAC-SHA-256 — if your Storyblok webhook is configured for SHA-1,
  change it in the Storyblok UI.

### Page still serves stale content after a publish event
- Confirm the webhook delivery actually returned 200 (CMS-side log).
- Confirm the active provider's `mapWebhookPayload` returns the
  expected event shape — verify with a unit test using a captured
  payload.
- For unrecognised payloads the service falls back to a broad
  `invalidateAll()`. If you see this happening for events you'd expect
  to be granular, extend `mapWebhookPayload` to cover the case.

### `500 Failed to handle CMS webhook`
- The server log contains the stack trace via `LoggerService.error`.
- Most likely cause: the active adapter threw an exception inside
  `handleWebhook` (which it should not — SPI invariant). Patch the
  adapter to surface the failure through the response envelope.
