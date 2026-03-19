# Site Middleware Documentation

## Overview

The Emporix Showcase application implements a sophisticated multi-site routing system that works in harmony with Next.js internationalization (i18n). This system allows the application to serve multiple sites/tenants from a single codebase while maintaining proper locale handling.

## Architecture

The site middleware system consists of several key components:

### Core Files

- `src/site/middleware.ts` - Core site resolution and middleware logic
- `src/site/types.ts` - TypeScript type definitions
- `src/site/config.ts` - Site routing configurations
- `src/site/routing.ts` - Configuration loader
- `src/site/probe-detection.ts` - Health-check probe detection
- `src/proxy.ts` - Main application middleware that orchestrates site, auth, and cache handling

## Domain-based Site Recognition (Pre-auth)

The middleware selects an applicable routing configuration based on the request hostname
before any login state is known. This ensures that users arriving on a domain such as
`shop.pl` are immediately routed to the correct site context.

In practice, the domain match happens first, and then site resolution (path/cookie/header)
is executed within that domain context.

Example (from `src/site/config.ts`):

```
domain: 'showcase.emporix.la' -> defaultSite: <DEFAULT_SITE>
domain: 'localhost' -> defaultSite: <DEFAULT_SITE>
```

## Site Resolution Strategy

The site middleware uses a hierarchical resolution strategy to determine which site to serve:

### 1. Path-based Resolution (Highest Priority)

```
/site-name/locale/path → site: "site-name"
/main/en/products → site: "main"
```

### 2. Cookie-based Resolution

If no site is found in the path, the middleware checks for a site cookie:

```typescript
cookies.get(routing.cookie)?.value
```

### 3. Header-based Resolution

If no cookie is found, it checks for a site header:

```typescript
headers.get(routing.header)
```

### 4. Default Site (Fallback)

Finally, it falls back to the configured default site (if one is configured).

### 5. Post-Resolution Validation

After resolution, the middleware validates that the resolved site exists in `availableSites`. If the site comes from a cookie or header and is not in the list, the behavior depends on the fallback configuration (see [Fallback Behavior](#fallback-behavior) below).

## Configuration

### Environment Variables

```bash
# Available sites (comma-separated)
NEXT_PUBLIC_AVAILABLE_SITES=main,tenant1,tenant2

# Default site when no site is specified.
# When set: unknown site requests fall back to this site (redirect).
# When empty or omitted: unknown site requests show a 404 error page (no fallback).
NEXT_PUBLIC_DEFAULT_SITE=main

# Site routing configuration to use
NEXT_PUBLIC_SITE_ROUTING_CONFIG=default
```

### Site Configuration Structure

The site configuration is defined in `src/site/config.ts`:

```typescript
export type SiteConfig = {
  defaultSite?: string;          // Optional default site identifier (omit to disable fallback)
  availableSites: string[];      // List of available site identifiers
  prefix: SitePrefixMode;        // URL prefix behavior ('always' | 'as-needed' | 'never')
  header?: string;               // Optional header name for site detection
  cookie?: string;               // Optional cookie name for site persistence
}

export type SiteDomainConfig = SiteConfig & {
  domain: string | RegExp;       // Domain matcher (string or regex)
}

export type SiteRoutingConfig = SiteConfig & {
  domains: SiteDomainConfig[];   // Domain-specific configurations
}
```

### Configuration Examples

#### Default Configuration

```typescript
{
  defaultSite: 'main',
  availableSites: ['main', 'tenant1', 'tenant2'],
  prefix: 'as-needed',
  domains: [
    {
      domain: 'showcase.emporix.io',
      defaultSite: 'main',
      availableSites: ['main', 'tenant1', 'tenant2'],
      prefix: 'as-needed'
    }
  ]
}
```

#### Local Development Configuration

```typescript
{
  defaultSite: 'main',
  availableSites: ['main', 'tenant1', 'tenant2'],
  prefix: 'as-needed',
  domains: [
    {
      domain: 'localhost',
      defaultSite: 'main',
      availableSites: ['main', 'tenant1', 'tenant2'],
      prefix: 'as-needed'
    }
  ]
}
```

## URL Prefix Modes

The `prefix` configuration determines how sites appear in URLs:

### `'as-needed'` (Recommended)

- Default site: URLs without site prefix (`/en/products`)
- Other sites: URLs with site prefix (`/tenant1/en/products`)

### `'always'`

- All sites: URLs always include site prefix (`/main/en/products`, `/tenant1/en/products`)

### `'never'`

- All sites: URLs never include site prefix (`/en/products`)
- Site resolution relies on cookies, headers, or domain mapping

## Integration with Internationalization

The site middleware works seamlessly with Next.js internationalization:

### URL Structure

```
/[site]/[locale]/[...path]
```

Examples:

- `/main/en/products` - Main site, English locale
- `/tenant1/de/products` - Tenant1 site, German locale
- `/en/products` - Default site (main), English locale (when prefix is 'as-needed')

### Middleware Chain

1. **Authentication** - NextAuth handles authentication
2. **Site Resolution** - Custom site middleware resolves the site
3. **Internationalization** - Next-intl handles locale resolution
4. **Security Headers** - Security headers are applied

## Implementation Details

### Core Functions

#### `resolveSite(pathname, cookies, headers, routing)`

Resolves the site identifier from the request using the hierarchical strategy.

**Parameters:**

- `pathname`: Request pathname
- `cookies`: Request cookies
- `headers`: Request headers  
- `routing`: Site configuration

**Returns:**

```typescript
{
  site: string | undefined;  // Resolved site identifier (undefined when no default configured and no match)
  appPath: string;           // Remaining path after site removal
}
```

#### `resolveApplicableRouting(hostname, routing)`

Determines which routing configuration to use based on the request hostname.

**Parameters:**

- `hostname`: Request hostname
- `routing`: Complete site routing configuration

**Returns:** The applicable `SiteConfig` for the hostname

#### `createSiteMiddleware(routingConfig)`

Creates the site middleware function with the provided configuration.

**Parameters:**

- `routingConfig`: Complete site routing configuration

**Returns:** Middleware function compatible with Next.js

### URL Rewriting and Redirects

The middleware handles URL rewriting and redirects based on the prefix configuration:

#### When `prefix: 'never'` or default site with `'as-needed'`

- **Input:** `/main/en/products`
- **Action:** Redirect to `/en/products`
- **Internal:** Rewrite to `/main/en/products`

#### When site should be in URL but isn't

- **Input:** `/en/products` (for non-default site)
- **Action:** Redirect to `/tenant1/en/products`

### Headers Set by Middleware

The site middleware sets the following headers:

- `x-request-emp-site`: The resolved site identifier
- `x-middleware-rewrite`: Internal rewrite URL (for Next.js)

## Usage in Main Middleware

The site middleware is integrated into the main application middleware (`src/proxy.ts`):

```typescript
import NextAuth from 'next-auth';
import { applyCacheDirectives } from './caching/cache-middleware';
import { createSiteMiddleware } from './site/middleware';
import { routing as siteRouting } from './site/routing';
import { config as authConfig } from './auth/auth.config';

const { auth } = NextAuth(authConfig);
const siteMiddleware = createSiteMiddleware(siteRouting);

const authMiddleware = auth((req) => {
  const response = siteMiddleware(req);
  return applyCacheDirectives(req, response);
});

export default async function middleware(req: NextRequest) {
  // API requests are handled separately (CSRF validation, cache directives)
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return applyCacheDirectives(req, NextResponse.next());
  }

  return authMiddleware(req);
}
```

## Configuration Management

### Adding New Sites

1. **Update Environment Variables:**
  ```bash
   NEXT_PUBLIC_AVAILABLE_SITES=main,tenant1,tenant2,new-site
  ```
2. **Update Site Configuration** (if needed):
  ```typescript
   // src/site/config.ts
   availableSites: ['main', 'tenant1', 'tenant2', 'new-site']
  ```
3. **Domain-Specific Configuration** (optional):
  ```typescript
   domains: [
     {
       domain: 'new-site.example.com',
       defaultSite: 'new-site',
       availableSites: ['new-site'],
       prefix: 'never'
     }
   ]
  ```

### Environment-Specific Configurations

Create different configurations for different environments:

```typescript
// src/site/config.ts
export default {
  default: { /* production config */ },
  local: { /* local development config */ },
  staging: { /* staging config */ }
}
```

Set the configuration via environment variable:

```bash
NEXT_PUBLIC_SITE_ROUTING_CONFIG=staging
```

## Fallback Behavior

The `NEXT_PUBLIC_DEFAULT_SITE` environment variable acts as a **fallback toggle**:

### Fallback ON (`NEXT_PUBLIC_DEFAULT_SITE=main`)


| Scenario                         | Behavior                                    |
| -------------------------------- | ------------------------------------------- |
| Valid site in path/cookie/header | Site is used normally                       |
| Invalid site in cookie/header    | Replaced with default site, redirect occurs |
| No site specified                | Default site is used                        |
| Invalid site in path             | Redirect to default site                    |


### Fallback OFF (`NEXT_PUBLIC_DEFAULT_SITE=` or omitted)


| Scenario                         | Behavior                                            |
| -------------------------------- | --------------------------------------------------- |
| Valid site in path/cookie/header | Site is used normally                               |
| Invalid site in cookie/header    | 404 error page shown, structured error logged       |
| No site specified                | 1st site from `NEXT_PUBLIC_AVAILABLE_SITES` is used |
| Invalid site in path             | 404 error page shown                                |


When fallback is OFF:

- Invalid site requests are flagged with an `x-site-invalid` header at the middleware level
- The layout checks this header and calls `notFound()` before making any API calls
- Site cookies are **not** updated for invalid site requests (preserving previous valid state)
- A structured JSON error is logged for developer diagnostics

## Best Practices

### 1. Site Naming

- Use lowercase, URL-safe identifiers
- Avoid special characters except hyphens
- Keep names short and descriptive

### 2. Default Site Strategy

- **With fallback (recommended for most setups):** Set `NEXT_PUBLIC_DEFAULT_SITE` to your primary site. Unknown sites redirect gracefully.
- **Without fallback (strict mode):** Leave `NEXT_PUBLIC_DEFAULT_SITE` empty. Unknown sites produce a 404. Use this when you want to detect misconfiguration early.
- Use `'as-needed'` prefix mode for clean URLs
- When using a default site, ensure it is included in `availableSites`

### 3. Domain Mapping

- Use domain-specific configurations for multi-domain setups
- Consider using regex patterns for subdomain matching
- Test domain configurations thoroughly

### 4. Cookie and Header Configuration

- Use cookies for site persistence across sessions
- Use headers for API-based site selection
- Ensure cookie names don't conflict with other application cookies
- Note: cookie/header values are validated against `availableSites` after resolution

## Troubleshooting

### Common Issues

1. **Site not resolving correctly**
  - Check `availableSites` configuration
  - Verify environment variables are set
  - Ensure site identifier matches exactly
2. **Infinite redirects**
  - Check prefix configuration consistency
  - Verify default site configuration
  - Review domain matching logic
3. **Locale issues**
  - Ensure locale configuration is compatible with site configuration
  - Check that all sites support the same locales
  - Verify middleware order (site before locale)

### Debugging

**Misrouted health checks** are detected and logged with a structured JSON payload (via `console.warn`) to make filtering easy in App Insights. The middleware responds with a lightweight `200 OK` and these headers:

- `x-misrouted-healthcheck: 1`
- `x-recommended-endpoint: /api/health`
- `x-alternative-endpoint: /api/ready`

**Invalid site requests** (when fallback is OFF) are also logged with a structured JSON payload:

```json
{
  "event": "invalid_site_rejected",
  "site": "bad-site",
  "path": "/bad-site/en/products",
  "availableSites": ["main", "tenant1"],
  "recommendation": "Check NEXT_PUBLIC_AVAILABLE_SITES configuration"
}
```

The request is flagged with `x-site-invalid: true` header and routed to the 1st available site for layout rendering, where `notFound()` is called to display the 404 page.

## Security Considerations

- Site identifiers are validated against `availableSites`
- Domain matching prevents site spoofing
- Headers are properly sanitized
- CSRF protection is maintained across site switches

## Performance Considerations

- Site resolution is optimized for minimal overhead
- Domain matching uses efficient string/regex comparison
- Middleware runs on Edge Runtime for optimal performance
- Configurations are loaded once at startup

