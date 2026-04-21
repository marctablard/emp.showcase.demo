# Emporix API Client for Next.js

This module provides a TypeScript implementation of the Emporix API for use in Next.js applications. It is designed to work with the InversifyJS dependency injection system.

## Features

- OAuth authentication (anonymous, customer, and service tokens)
- Token caching and automatic refresh
- TypeScript interfaces for API responses
- Injectable services compatible with InversifyJS

## Usage

### Setup

1. Register the services in your InversifyJS container:

```typescript
// In your container configuration
import { Container } from 'inversify';
import { EmporixApiClient } from './integration/apis/emporix/EmporixApiClient';
import { EmporixConfig } from './integration/apis/emporix/config';
import { DefaultEmporixOAuthApi } from './integration/apis/emporix/impl/DefaultEmporixOAuthApi';
import { OAuthApi } from './integration/apis/emporix/types/apis/OAuthApi';

const container = new Container();

// Register the OAuth API implementation
container.bind<OAuthApi>('OAuthApi').to(DefaultEmporixOAuthApi);

// Register the Emporix API client
container.bind<EmporixApiClient>(EmporixApiClient).toSelf();

// Register the Emporix configuration
container.bind<EmporixConfig>('EmporixConfig').toConstantValue({
  baseUrl: 'https://api.emporix.io',
  tenant: 'your-tenant-id',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
});
```

### Using the API Client

```typescript
// In your service or component
import { inject, injectable } from 'inversify';
import { EmporixApiClient } from './integration/apis/emporix/EmporixApiClient';

@injectable()
export class ProductService {
  constructor(@inject(EmporixApiClient) private emporixClient: EmporixApiClient) {}

  async getProducts() {
    // Get an anonymous token for public access
    const token = await this.emporixClient.getAnonymousToken();

    // Make an authenticated request
    const response = await this.emporixClient.authenticatedFetch(
      'https://api.emporix.io/product/products',
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      },
      'anonymous', // Use anonymous token
    );

    return response.json();
  }

  // Example of a method requiring service access token
  async createProduct(productData: any) {
    const response = await this.emporixClient.authenticatedFetch(
      'https://api.emporix.io/product/products',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(productData),
      },
      'service', // Use service token
    );

    return response.json();
  }
}
```

## API Reference

### EmporixApiClient

The main client for interacting with Emporix APIs.

#### Methods

- `getAnonymousToken()`: Get an anonymous token for accessing public resources
- `getCustomerToken(username, password)`: Get a customer token for authenticated user access
- `getServiceAccessToken([clientId], [clientSecret])`: Get a service access token for administrative operations
- `authenticatedFetch(url, options, tokenType, authOptions?, metrics?, cacheSeconds?)`: Create a fetch request with the appropriate authentication headers. Supported `tokenType` values: `'public'`, `'session'`, `'customer-saas'`, `'ai'`, `'service'`. See the **Caching** section below for the `cacheSeconds` semantics.
- `clearTokens()`: Clear all stored tokens

### Caching

Caching is **opt-in per call**, not implied by `tokenType`:

- Pass `cacheSeconds` (trailing argument) to enable Next fetch caching for that call. It sets `cache: 'force-cache'` and `next: { revalidate: cacheSeconds }`.
- It applies only to `GET`/`HEAD` requests, and only when the caller has not already set `options.cache` or `options.next` explicitly (explicit options always win).
- Write methods (`POST`/`PUT`/`PATCH`/`DELETE`) are always forced to `cache: 'no-store'` regardless of `cacheSeconds`.
- Omit `cacheSeconds` for anything volatile or shopper-specific (orders, approvals, cart-ownership-sensitive reads, custom entities, per-session data). Use it only for reference / catalog-style reads.
- For reference/catalog reads, prefer the shared `DEFAULT_CACHE_REVALIDATE` constant from `src/platform/integrations/emporix/common/cache-defaults.ts` instead of hard-coded literals, so the TTL stays consistent across integrations. It reads the same `NEXT_PUBLIC_CACHE_DEFAULT_REVALIDATE` env var as the HTTP cache middleware (`src/caching/cache-config.ts`), so a single setting controls the default revalidation window across both layers. The default is `3600` seconds; non-positive or non-numeric values fall back to `3600`. The `NEXT_PUBLIC_` prefix is required because this module can be evaluated from the client DI container graph (non-public env vars resolve to `undefined` in the browser bundle). See `docs/cache-middleware.md` for the shared semantics.

### TokenManager

Manages token caching and refreshing.

#### Methods

- `getAnonymousToken(tenant)`: Get a valid anonymous token, refreshing if necessary
- `getCustomerToken(tenant, username, password)`: Get a valid customer token, refreshing if necessary
- `getServiceAccessToken(tenant, clientId, clientSecret)`: Get a valid service access token, refreshing if necessary
- `clearTokens()`: Clear all stored tokens
