# Environment Variables Configuration

This document explains key configuration concepts for the Emporix Showcase application. For a complete list of all available variables with inline comments, see [`.env.template`](../.env.template).

## Getting Started

1. Copy `.env.template` to `.env`
2. Configure the required variables (see checklist below)
3. Adjust optional settings as needed

## Configuration Structure

The `.env.template` file is organized into three main sections:

### 🔴 Sensitive Configuration
Secrets, passwords, and private keys that should **never be committed** to version control.

### 🟡 Environment-Specific Configuration
Values that vary between environments (dev/staging/production) but aren't necessarily secret.

### ⚙️ General Configuration
Default settings, feature flags, and system configuration.

## Key Concepts

### Emporix API: Client-Side vs Server-Side

The application uses **two different sets of credentials** for Emporix API access:

#### Client-Side (Public/Storefront API)
- Variables: `NEXT_PUBLIC_EMPORIX_*`
- Exposed to the browser
- Use your **Storefront API Key**
- Used for public operations (browsing products, anonymous cart)

#### Server-Side (Private/Backend API)
- Variables: `NEXT_EMPORIX_*` (without `PUBLIC`)
- Kept secret on the server
- Use your **Emporix API Key**
- Used for privileged operations (order management, customer data)

### NextAuth Configuration

#### `NEXTAUTH_SECRET`
**Critical:** Generate a secure random string for session encryption.

```bash
openssl rand -base64 32
```

#### `NEXTAUTH_URL`
- **Development:** `http://localhost:3000`
- **Production:** Your actual domain (e.g., `https://shop.example.com`)

### Logging Configuration

The application uses PINO logger for structured logging. Log levels and behavior can be controlled via environment variables.

#### `NEXT_LOG_LEVEL` (Server-Side)

Controls the log level for server-side logging (API routes, Server Components, platform services):

- `trace` - Most verbose (development only)
- `debug` - Detailed debugging information (default in development)
- `info` - Informational messages (default in production)
- `warn` - Warning messages
- `error` - Error messages only
- `fatal` - Fatal errors only

**Example:**
```env
# Development - verbose logging
NEXT_LOG_LEVEL=debug

# Production - minimal logging
NEXT_LOG_LEVEL=info
```

#### `NEXT_PUBLIC_LOG_LEVEL` (Client-Side)

Controls the log level for client-side logging (browser):

- `debug` - Detailed debugging information (default in development)
- `info` - Informational messages
- `warn` - Warning messages (default in production)
- `error` - Error messages only

**Example:**
```env
# Development - show debug logs in browser console
NEXT_PUBLIC_LOG_LEVEL=debug

# Production - only show warnings and errors
NEXT_PUBLIC_LOG_LEVEL=warn
```

#### `NEXT_PUBLIC_LOG_ENABLED` (Client-Side)

Controls whether client-side logging is enabled:

- `true` - Enable client-side logging (default in development)
- `false` - Disable client-side logging (recommended for production)

**Example:**
```env
# Enable client-side logging (development)
NEXT_PUBLIC_LOG_ENABLED=true

# Disable client-side logging (production)
NEXT_PUBLIC_LOG_ENABLED=false
```

**Note:** Client-side logging is automatically enabled in development mode and disabled in production unless explicitly set.

### Debug Settings

The application includes a comprehensive API debug system that provides real-time visibility into upstream API calls in both the **server terminal** (with colorized pretty-printing) and the **browser DevTools Console** (via an SSE stream with collapsible groups).

#### `NEXT_PUBLIC_DEBUG_API_CURL`

Log a `curl` command for every upstream API call. Useful for reproducing API calls manually:

- `true` – Log curl commands (headers and query params are masked unless verbose mode is on)
- `false` – Don't log curl commands (default)

```env
NEXT_PUBLIC_DEBUG_API_CURL=true
```

#### `NEXT_PUBLIC_DEBUG_API_RESPONSE`

Controls the verbosity of API response logging. This also enables the **Browser DevTools Debug Stream** — when set to any value other than `OFF`, upstream API calls appear as collapsible groups in the browser Console (via the `ApiDebugPanel` component).

- `OFF` - No response logging, no browser debug stream (default, use in production)
- `STATUS` - Log only HTTP method + status code
- `STATUS-HEADERS` - Log status code and response headers
- `STATUS-BODY-{n}` - Log status and first N characters of response body (e.g. `STATUS-BODY-200`)
- `STATUS-BODY` - Log status and full response body (pretty-printed with ANSI colors in terminal)
- `FULL` - Log everything (status, headers, full body)

**Example:**
```env
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS-BODY
```

**Terminal output** is formatted with `pino-pretty` and colorized JSON:
- Keys in **cyan**, string values in **yellow**, numbers in **magenta**, booleans/null in **green**
- Multi-line indented output for easy scanning

**Browser Console output** uses styled `console.groupCollapsed`:
- Color-coded by status (green 2xx, orange 4xx, red 5xx)
- Response bodies displayed via `console.dir` for full object expansion
- Response headers displayed via `console.table`

#### `NEXT_PUBLIC_DEBUG_API_ENDPOINTS`

Restrict debugging to specific endpoints to reduce noise. The value is a comma-separated list of path substrings — only URLs containing at least one of these substrings will be logged. Case-insensitive.

```env
# Debug only orders and returns
NEXT_PUBLIC_DEBUG_API_ENDPOINTS=order,return

# Debug only cart calls
NEXT_PUBLIC_DEBUG_API_ENDPOINTS=cart

# Debug all endpoints (leave empty — this is the default)
NEXT_PUBLIC_DEBUG_API_ENDPOINTS=
```

> **Tip:** This filter applies to both the terminal log and the browser debug stream. After changing, restart the dev server.

#### `NEXT_PUBLIC_DEBUG_API_VERBOSE`

Controls whether sensitive data (tokens, secrets, API keys) is shown in debug output:

- `true` – Show raw values (use only in local development)
- `false` – Mask sensitive values as `******` (default, always in production)

```env
NEXT_PUBLIC_DEBUG_API_VERBOSE=true
```

#### `NEXT_DEBUG_API_PAYLOAD`

Log request body for outgoing POST/PUT/PATCH API calls. Useful for debugging what data is being sent to external APIs:

- `true` – Log request bodies (truncated to 500 chars in masked mode)
- `false` – Don't log request bodies (default)

```env
NEXT_DEBUG_API_PAYLOAD=true
```

**Note:** This is a server-side-only variable (no `NEXT_PUBLIC_` prefix) because request payload logging only makes sense on the server where API calls are made.

#### `JEST_DEBUG_API` (Test Runs)

Controls API debug verbosity specifically during Jest runs.

- `false` (default) - Keep test output concise by forcing API debug logs off in Jest setup
- `true` - Re-enable API debug output during tests for troubleshooting

When `JEST_DEBUG_API` is not set to `true`, Jest setup forces:

```env
NEXT_PUBLIC_DEBUG_API_CURL=false
NEXT_PUBLIC_DEBUG_API_RESPONSE=off
NEXT_DEBUG_API_PAYLOAD=false
```

**Example:**
```bash
# Enable verbose API debug logs only for this Jest run
JEST_DEBUG_API=true npm run jest
```

#### `NEXT_PUBLIC_DEBUG_API_OUTPUT`

Controls **where** debug output is sent. Useful when you only want terminal output (e.g. CI) or only browser output (e.g. remote debugging):

- `BOTH` – Log to both server terminal and browser DevTools Console (default)
- `TERMINAL` – Log only to the server terminal (no SSE events emitted)
- `BROWSER` – Log only to the browser DevTools Console (terminal is silent)

```env
NEXT_PUBLIC_DEBUG_API_OUTPUT=TERMINAL
```

#### `NEXT_PUBLIC_DEBUG_API_CALL_TYPE`

Filter debug output by **call direction**. Helps isolate whether an issue is in your internal API routes or in external upstream APIs:

- `ALL` – Log both internal and external calls (default)
- `INTERNAL` – Log only internal API route calls (browser → `/api/*`)
- `EXTERNAL` – Log only external upstream API calls (server → Emporix API)

```env
# Only show external Emporix API calls
NEXT_PUBLIC_DEBUG_API_CALL_TYPE=EXTERNAL
```

> **Tip:** Internal calls are logged by API routes that use the `withApiRouteDebug()` wrapper. External calls are logged automatically by `EmporixApiInvoker`.

#### `NEXT_PUBLIC_DEBUG_API_SOURCE`

Filter debug output by **call origin**. Useful for isolating issues in client-triggered flows vs server-side rendering:

- `ALL` – Log calls from all sources (default)
- `CLIENT` – Log only calls originating from browser requests (via API routes)
- `SSR` – Log only calls originating from server-side rendering / RSC

```env
NEXT_PUBLIC_DEBUG_API_SOURCE=CLIENT
```

#### `NEXT_PUBLIC_DEBUG_API_BROWSER_DETAILS`

Controls which detail sections appear in the **browser DevTools Console** for each API call. Comma-separated list:

- `PAYLOAD` – Show the request body (outgoing payload)
- `HEADERS` – Show response headers
- `BODY` – Show response body

```env
# Show everything (default)
NEXT_PUBLIC_DEBUG_API_BROWSER_DETAILS=PAYLOAD,HEADERS,BODY

# Only show payloads and response bodies (skip headers)
NEXT_PUBLIC_DEBUG_API_BROWSER_DETAILS=PAYLOAD,BODY

# Only show response body
NEXT_PUBLIC_DEBUG_API_BROWSER_DETAILS=BODY
```

> **Note:** This only affects the browser Console output. Terminal output is still controlled by `NEXT_PUBLIC_DEBUG_API_RESPONSE`.

#### `NEXT_PUBLIC_DEBUG_API_LEVEL`

Filter debug log output by response severity. Only responses matching the minimum level are logged.

| Value | What is logged |
| --- | --- |
| `ALL` (default) | Every request/response |
| `WARN` | Responses with status ≥ 400 (client + server errors) |
| `ERROR` | Responses with status ≥ 500 (server errors only) |

```env
# Show only server errors
NEXT_PUBLIC_DEBUG_API_LEVEL=ERROR

# Show 4xx and 5xx responses
NEXT_PUBLIC_DEBUG_API_LEVEL=WARN
```

> **Note:** Pre-response logs (curl commands, request payloads) are always emitted because the status is not yet known. The filter is applied at response time.

#### Full API Debugging Example

```env
# Recommended dev setup for debugging specific API calls
NEXT_PUBLIC_DEBUG_API_CURL=true
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS-BODY
NEXT_PUBLIC_DEBUG_API_ENDPOINTS=order,return
NEXT_PUBLIC_DEBUG_API_VERBOSE=false
NEXT_DEBUG_API_PAYLOAD=true

# Advanced: filter by call type or source
# NEXT_PUBLIC_DEBUG_API_OUTPUT=BOTH
# NEXT_PUBLIC_DEBUG_API_CALL_TYPE=ALL
# NEXT_PUBLIC_DEBUG_API_SOURCE=ALL
# NEXT_PUBLIC_DEBUG_API_BROWSER_DETAILS=PAYLOAD,HEADERS,BODY
# NEXT_PUBLIC_DEBUG_API_LEVEL=ALL
```

### Application defaults (required `NEXT_PUBLIC_*`)

Runtime defaults for **currency, site, language, country, region, and Emporix unit code** must not be hardcoded in application logic. They are read from public environment variables and exposed through [`src/lib/common/public-default-env.ts`](../src/lib/common/public-default-env.ts).

#### Why the helpers exist

- **Single source of truth:** Aligns storefront behavior with deploy-time configuration (see [`.env.template`](../.env.template) for example values).
- **Next.js inlining:** Each getter passes a **static** `process.env.NEXT_PUBLIC_*` expression into the module. Next only inlines public env vars for direct property access; dynamic lookups such as `process.env[key]` stay `undefined` in the browser bundle and would break client components (for example `formatCurrency`).

If any of these variables is missing or whitespace-only after trim, the corresponding getter throws `Missing required environment variable: <KEY>`. The same keys are part of Tier-1 startup / Jest validation ([`src/platform/healthcheck/env-validation.ts`](../src/platform/healthcheck/env-validation.ts)); see [Health checks](./health-checks.md).

| Variable | Getter | Role |
| --- | --- | --- |
| `NEXT_PUBLIC_DEFAULT_CURRENCY` | `getPublicDefaultCurrency()` | ISO currency code used when session, site, or domain data does not supply a currency (cart totals, AI cards, product pricing fallbacks, auth flows, and similar). |
| `NEXT_PUBLIC_DEFAULT_SITE` | `getPublicDefaultSite()` | Site code used when the request or session has no site (site resolution, session mapping, auth redirects, hooks). Also referenced elsewhere for routing; see [Site middleware](./site-middleware.md) for interaction with `NEXT_PUBLIC_AVAILABLE_SITES`. |
| `NEXT_PUBLIC_DEFAULT_LANGUAGE` | `getPublicDefaultLanguage()` | BCP-47 language tag when no locale is in context (middleware, server context, product tiles, notifications, AI chat). Used as the **`Intl.NumberFormat` locale** in `formatCurrency` / `formatCurrencyCompact` in [`src/lib/utils.ts`](../src/lib/utils.ts) when the `locale` argument is omitted, so grouping, symbols, and spacing follow this default language. |
| `NEXT_PUBLIC_DEFAULT_COUNTRY` | `getPublicDefaultCountry()` | Default country code; validated at startup. Session and OAuth layers also read `process.env.NEXT_PUBLIC_DEFAULT_COUNTRY` for defaults and token requests. |
| `NEXT_PUBLIC_DEFAULT_REGION` | `getPublicDefaultRegion()` | Default region name; validated at startup and used alongside country in session / OAuth configuration. |
| `NEXT_PUBLIC_EMPORIX_DEFAULT_UNIT_CODE` | `getPublicDefaultUnitCode()` | Default Emporix unit code for line items when the API needs a unit (for example quote creation in [`src/app/api/quote/route.ts`](../src/app/api/quote/route.ts)). |

#### `NEXT_PUBLIC_FALLBACK_PRICES` (optional)

Controls Emporix **price match** fallback for explicit `POST …/match-prices` calls (site + currency + country criteria) from [`EmporixPriceService`](../src/platform/services/price/impl/EmporixPriceService.ts).

- **Unset, empty, or any value other than** `true` / `1` / `yes` (case-insensitive): sends `useFallback: false` — if no price exists for the requested `siteCode`, the API does not retry against the `main` site.
- **`true` / `1` / `yes`:** sends `useFallback: true` — when no price matches the requested site, Emporix runs matching again for `main` (see [Price matching](https://developer.emporix.io/api-references/api-guides/prices-and-taxes/price-service/api-reference/price-matching)).

Read via `getPublicPriceMatchUseFallback()` in [`src/lib/common/public-default-env.ts`](../src/lib/common/public-default-env.ts). Does **not** affect `match-prices-by-context` (session-driven matching has no `useFallback` in the request body).

Some platform modules still read `process.env.NEXT_PUBLIC_DEFAULT_COUNTRY` or `NEXT_PUBLIC_DEFAULT_REGION` directly for historical reasons; new code should prefer the getters when on code paths that already use `public-default-env`, so values stay trim-validated and bundle-inlining stays correct.

### Multi-Site Support

The application supports multiple sites/storefronts:

- `NEXT_PUBLIC_DEFAULT_SITE` — default site identifier (see **Application defaults** above and [Site middleware](./site-middleware.md))
- `NEXT_PUBLIC_AVAILABLE_SITES` - Comma-separated list of all sites
- `NEXT_PUBLIC_STORYBLOK_MULTI_SITE` - Enable folder-based multi-site in Storyblok

### Push Notifications

#### VAPID Keys

Generate VAPID keys for web push notifications:

```bash
npx web-push generate-vapid-keys
```

Set the public key in `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and the private key in `VAPID_PRIVATE_KEY`.

These variables are **optional**:

- If `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is **missing** or empty, the storefront will treat push notifications as **disabled** and will not call the notifications API endpoints for push setup or polling.
- If `NEXT_PUBLIC_DISABLE_PUSH_NOTIFICATIONS` is set to `true`, push notifications are **explicitly disabled** regardless of VAPID configuration, and the frontend will not attempt to register a service worker subscription or call the push notification API endpoints.

To completely disable push notifications in any environment, you can either:

- Set `NEXT_PUBLIC_DISABLE_PUSH_NOTIFICATIONS=true`, or
- Leave `NEXT_PUBLIC_VAPID_PUBLIC_KEY` unset (and avoid configuring the server-side VAPID keys).

### Setup API

The Setup API (`NEXT_SETUP_API_*`) provides an endpoint for initial system configuration. **Disable in production** or secure with a strong secret.

### Feature Flags

| Variable | Values | Default | Description |
|----------|--------|---------|-------------|
| `NEXT_STARTUP_HEALTHCHECK_ENABLED` | `true` / `false` | `true` | Enable Tier 2 runtime startup healthcheck. When enabled, the server validates configured sites, currencies, and languages against the Emporix API at startup. See [Health Checks — Startup Configuration Validation](health-checks.md#startup-configuration-validation). |
| `NEXT_PUBLIC_DISABLE_PUSH_NOTIFICATIONS` | `true` / `false` | `false` | Explicitly disable push notifications regardless of VAPID key configuration. |

## Quick Start Checklist

Minimal configuration for local development:

- [ ] `NEXTAUTH_SECRET` - Generate with `openssl rand -base64 32`
- [ ] `NEXTAUTH_URL` - Set to `http://localhost:3000`
- [ ] `NEXT_PUBLIC_EMPORIX_TENANT` - Your Emporix tenant name
- [ ] `NEXT_PUBLIC_EMPORIX_CLIENT_ID` - Storefront API client ID
- [ ] `NEXT_PUBLIC_EMPORIX_CLIENT_SECRET` - Storefront API secret
- [ ] `NEXT_EMPORIX_CLIENT_ID` - Server API client ID
- [ ] `NEXT_EMPORIX_CLIENT_SECRET` - Server API secret

## Environment-Specific Settings

### Development
```env
# Logging
NEXT_LOG_LEVEL=debug
NEXT_PUBLIC_LOG_LEVEL=debug
NEXT_PUBLIC_LOG_ENABLED=true

# API Debugging — full visibility with colorized terminal output + browser Console stream
NEXT_PUBLIC_DEBUG_API_CURL=true
NEXT_PUBLIC_DEBUG_API_VERBOSE=true
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS-BODY
NEXT_DEBUG_API_PAYLOAD=true
# Optional: filter to specific endpoints to reduce noise
# NEXT_PUBLIC_DEBUG_API_ENDPOINTS=order,return
```

### Staging
```env
# Logging
NEXT_LOG_LEVEL=info
NEXT_PUBLIC_LOG_LEVEL=warn
NEXT_PUBLIC_LOG_ENABLED=false

# SEO & Debugging
NEXT_PUBLIC_ROBOTS_NOINDEX=true  # Prevent search engine indexing
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS
```

### Production
```env
# Logging
NEXT_LOG_LEVEL=info
NEXT_PUBLIC_LOG_LEVEL=warn
NEXT_PUBLIC_LOG_ENABLED=false

# General Settings
NEXT_PUBLIC_ROBOTS_NOINDEX=false
NEXT_SETUP_API_ENABLED=false
NEXT_PUBLIC_DISABLE_PUSH_NOTIFICATIONS=false   # Set to true to fully disable web push notifications

# API Debugging — OFF in production (no debug stream, no curl logging)
NEXT_PUBLIC_DEBUG_API_CURL=false
NEXT_PUBLIC_DEBUG_API_RESPONSE=OFF
NEXT_PUBLIC_DEBUG_API_VERBOSE=false
NEXT_DEBUG_API_PAYLOAD=false
```

## Security Best Practices

1. **Never commit `.env` files** - Only commit `.env.template`
2. **Use different credentials** for each environment
3. **Rotate secrets regularly** - Especially `NEXTAUTH_SECRET` and API keys
4. **Minimize `NEXT_PUBLIC_*` usage** - Only expose what's absolutely necessary to the browser
5. **Use secret management in production** - AWS Secrets Manager, Azure Key Vault, etc.
6. **Enable security headers** - The template includes sensible defaults for CORS, CSP, etc.

## Related Documentation

- [Deployment Process](./deployment-process.md)
- [Testing Guide](./testing-guide.md)
- [Storyblok Integration](./storyblok-integration.md)