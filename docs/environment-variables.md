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

### Debug Settings

#### `NEXT_PUBLIC_DEBUG_API_RESPONSE`

Controls the verbosity of API response logging. Useful for debugging API issues:

- `OFF` - No response logging (default, use in production)
- `STATUS` - Log only HTTP status code
- `STATUS-HEADERS` - Log status code and response headers
- `STATUS-BODY-200` - Log status and first 200 characters of response body
- `STATUS-BODY` - Log status and full response body
- `FULL` - Log everything (status, headers, full body)

**Example:**
```env
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS-BODY-500
```

#### `NEXT_PUBLIC_DEBUG_API_ENDPOINTS`

Restrict debugging to specific endpoints to reduce noise:

```env
# Debug only these endpoints
NEXT_PUBLIC_DEBUG_API_ENDPOINTS=site,price,product

# Debug all endpoints (leave empty)
NEXT_PUBLIC_DEBUG_API_ENDPOINTS=
```

### Multi-Site Support

The application supports multiple sites/storefronts:

- `NEXT_PUBLIC_DEFAULT_SITE` - Default site identifier
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
NEXT_PUBLIC_DEBUG_API_CURL=true
NEXT_PUBLIC_DEBUG_API_VERBOSE=true
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS-BODY-500
```

### Staging
```env
NEXT_PUBLIC_ROBOTS_NOINDEX=true  # Prevent search engine indexing
NEXT_PUBLIC_DEBUG_API_RESPONSE=STATUS
```

### Production
```env
NEXT_PUBLIC_ROBOTS_NOINDEX=false
NEXT_PUBLIC_DEBUG_API_RESPONSE=OFF
NEXT_SETUP_API_ENABLED=false
NEXT_PUBLIC_DISABLE_PUSH_NOTIFICATIONS=false   # Set to true to fully disable web push notifications
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