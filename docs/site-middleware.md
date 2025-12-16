# Site Middleware Documentation

## Overview

The Emporix Showcase application implements a sophisticated multi-site routing system that works in harmony with Next.js internationalization (i18n). This system allows the application to serve multiple sites/tenants from a single codebase while maintaining proper locale handling.

## Architecture

The site middleware system consists of several key components:

### Core Files

- `src/site/middleware.ts` - Core site resolution and middleware logic
- `src/site/types.d.ts` - TypeScript type definitions
- `src/site/config.ts` - Site routing configurations
- `src/site/routing.ts` - Configuration loader
- `src/middleware.ts` - Main application middleware that orchestrates site and auth handling

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
Finally, it falls back to the configured default site.

## Configuration

### Environment Variables

```bash
# Available sites (comma-separated)
NEXT_PUBLIC_AVAILABLE_SITES=main,tenant1,tenant2

# Default site when no site is specified
NEXT_PUBLIC_DEFAULT_SITE=main

# Site routing configuration to use
NEXT_PUBLIC_SITE_ROUTING_CONFIG=default
```

### Site Configuration Structure

The site configuration is defined in `src/site/config.ts`:

```typescript
export type SiteConfig = {
  defaultSite: string;           // Default site identifier
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
  site: string;      // Resolved site identifier
  appPath: string;   // Remaining path after site removal
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

The site middleware is integrated into the main application middleware (`src/middleware.ts`):

```typescript
import { createSiteMiddleware } from './site/middleware';
import { routing as siteRouting } from './site/routing';

const siteMiddleware = createSiteMiddleware(siteRouting);

export default auth(async (req: NextAuthRequest) => {
  // ... authentication and API handling ...
  
  // Apply site middleware for page requests
  return applySecurityHeaders(siteMiddleware(req) ?? NextResponse.next());
});
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

## Best Practices

### 1. Site Naming
- Use lowercase, URL-safe identifiers
- Avoid special characters except hyphens
- Keep names short and descriptive

### 2. Default Site Strategy
- Always configure a default site
- Use `'as-needed'` prefix mode for clean URLs
- Ensure the default site is included in `availableSites`

### 3. Domain Mapping
- Use domain-specific configurations for multi-domain setups
- Consider using regex patterns for subdomain matching
- Test domain configurations thoroughly

### 4. Cookie and Header Configuration
- Use cookies for site persistence across sessions
- Use headers for API-based site selection
- Ensure cookie names don't conflict with other application cookies

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

Enable debug logging by checking the console output in development mode. The middleware logs redirect decisions:

```typescript
console.debug('redirecting to appPath, because the site should not be supplied', `/${appPath}`);
console.debug('redirecting to appPath, because the site should be supplied', `/${site}/${appPath}`);
```

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
