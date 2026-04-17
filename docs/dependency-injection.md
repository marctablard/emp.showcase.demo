# Dependency Injection Framework Documentation

## Overview

Our Dependency Injection (DI) framework provides a robust, type-safe way to manage dependencies throughout the Emporix Showcase application. It enables loose coupling between components, making the codebase more maintainable, testable, and flexible.

## Why Dependency Injection?

1. **Separation of Concerns**: Each component focuses on its specific functionality without worrying about how its dependencies are created or managed.

2. **Testability**: Dependencies can be easily mocked during testing, allowing for isolated unit tests.

3. **Code Reusability**: Services and components can be reused across different parts of the application.

4. **Environment-Specific Implementations**: The framework supports **server** and **SSR** runtimes for all builds. **By default** the browser does not use an Inversify container; client code uses `@/lib/logger/browser-logger`, `@/lib/client/validation-registry`, and `fetch` to `/api/*`. Optionally, set `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` to `true` (or `1` / `yes`) and run `npm run generate` to emit `src/platform/client.ts` for advanced or fork use (see [How Generation Works](#how-generation-works)).

5. **Centralized Configuration**: All service registrations are managed in one place, making it easier to understand and modify the application's architecture.

## Technical Foundation

Our DI framework is built on [InversifyJS](https://inversify.io/), a powerful inversion of control container for TypeScript & JavaScript applications. We've extended Inversify with custom functionality to support:

- Automatic container generation
- **Server** and **SSR** containers in all configurations; **optional** browser `client.ts` when `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is enabled
- Unified platform container (`server.ts` / `ssr.ts`, and optionally `client.ts`) for services, integrations, and repositories
- File watching for development

## Core Principles

1. **Interface-Based Design**: Services are defined by interfaces, allowing for multiple implementations.

2. **Unified Platform Container**: Generated `src/platform/server.ts` and `src/platform/ssr.ts` always register integrations, services, and repositories together. `src/platform/client.ts` is generated only when `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is truthy (`true`, `1`, or `yes`) before `npm run generate`.

3. **Environment Awareness**: The generator always emits **server** and **SSR** containers (`import 'server-only'` on those entrypoints). **Optional** `client.ts` has no `server-only` import. Privileged Emporix integrations remain marked with `import 'server-only'` under `src/platform/integrations/**/impl/` where applicable.

4. **Code Generation**: Container configurations are automatically generated, reducing boilerplate and potential errors.

5. **Explicit Dependencies**: Dependencies are explicitly declared through constructor injection, making the code more readable and maintainable.

6. **Server-Side Initialization**: Containers are initialized on the server side through Next.js instrumentation, ensuring they're available throughout the application lifecycle.

## Usage Guide

### Defining a Service Interface

First, define an interface that describes the service's contract:

```typescript
// src/platform/services/hello/UserAgentService.d.ts
export interface UserAgentService {
  getUserAgent(): Promise<string>;
}
```

### Creating Implementations

Implement the interface with one or more concrete classes:

#### Server Implementation

```typescript
// src/platform/services/hello/impl/UserAgentServiceServer.ts
import { headers } from 'next/headers';
import type { UserAgentService } from '../UserAgentService';
import { injectable } from '@/platform/core/di/injectable';

@injectable('UserAgentService', 'Singleton')
class UserAgentServiceServer implements UserAgentService {
  async getUserAgent(): Promise<string> {
    const headersList = await headers();
    return headersList.get('user-agent') || 'No UserAgent supplied on Request';
  }
}

export default UserAgentServiceServer;
```

#### Optional `*Client` implementations

Classes whose names end with `Client` are included in **`src/platform/client.ts` only when** `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is enabled and containers are regenerated. **Default (flag off):** those classes are **not** emitted to any generated container; use APIs under `src/lib/client/*` in the browser. **Security:** enabling client generation binds `*Client` and shared injectables into a browser-loadable graph—audit bindings and run `npm run verify:client-chunks` after builds.

### Using the Injectable Decorator

The `@injectable` decorator is a key part of our DI system:

```typescript
@injectable(id?: string | symbol, scope?: BindingScope)
```

- **id**: The identifier used to resolve the service (typically the interface name)
- **scope**: The lifecycle of the instance ('Singleton', 'Transient', or 'Request')

### Consuming Services

Services can be consumed by other services through constructor injection:

```typescript
// src/platform/services/hello/impl/HelloAgentService.ts
import type { HelloService } from '../HelloService';
import { injectable } from '@/platform/core/di/injectable';
import type { UserAgentService } from '../UserAgentService';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { inject } from 'inversify';

@injectable('HelloService', 'Singleton')
class HelloAgentService implements HelloService {
  constructor(
    @inject('UserAgentService') private userAgentService: UserAgentService,
    @inject('LoggerService') private logger: LoggerService,
  ) {}

  async sayHello(): Promise<string> {
    try {
      const userAgent = await this.userAgentService.getUserAgent();

      return `Hello Agent! Your browser agent is: ${userAgent}`;
    } catch (error) {
      this.logger.error({ error }, 'Error reading server-only file');
      return 'Hello Server Error (file could not be read)';
    }
  }
}

export default HelloAgentService;
```

### Why `Server`, `SSR`, and common classes exist

1. **Server** (`*Server`): API routes, auth, and other Node-only code use `import server from '@/platform/server'` (the generated file starts with `import 'server-only'`).
2. **SSR** (`*SSR` or common classes picked up by the SSR graph): Server Components and `src/lib/ssr/*` use `import ssr from '@/platform/ssr'` (also `server-only`).
3. **Browser**: **Default:** no container — use `@/lib/logger/browser-logger`, `@/lib/client/validation-registry`, and `fetch('/api/…')`. **Opt-in:** `import client from '@/platform/client'` after enabling `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` and running `npm run generate`.

The generator merges **common** injectables (no `Client` / `Server` / `SSR` suffix) into `server.ts` and `ssr.ts` unless a suffixed class overrides the same service id for that environment. Classes ending in `Client` are merged into **`client.ts` only when** client generation is enabled; otherwise they are omitted from all generated containers.

## Container Generation

Our DI framework includes a code generation system that automatically creates container configuration files. This reduces boilerplate code and ensures consistency.

### Generation Scripts

The following scripts are available in `package.json`:

```json
"scripts": {
  "dev": "npm-run-all --parallel generate:watch dev:next",
  "generate": "ts-node --project scripts/tsconfig.json scripts/di-generator.ts",
  "generate:watch": "ts-node --project scripts/tsconfig.json scripts/di-generator.ts --watch"
}
```

- **generate**: Scans the codebase for `@injectable` decorators and generates container files.
- **generate:watch**: Continuously watches for changes and regenerates containers as needed.
- **dev**: Runs both the development server and the container generator in watch mode.

### Dependency Aliases (depency.yml)

In addition to scanning `@injectable(...)` modules, the generator can apply dependency alias mappings from a YAML config file:

- `src/platform/depency.yml`

This is useful when you want to resolve a stable identifier (e.g. `SearchService`) but transparently map it to a different binding (e.g. `BatteryIncludedSearchService`) without changing all call sites.

The recommended (clean) format is:

```yml
Services:
  SearchService: BatteryIncludedSearchService

Integrations:
  EmporixProductApi: EmporixProductApi
```

The alias key (left side) and target key (right side) must match actual container binding identifiers.

#### Environment-specific alias configs

You can provide different alias mappings per environment.

Resolution order:

1. `DI_DEPENDENCY_FILE`
2. `DI_ENV` (fallback: `NODE_ENV`) using `src/platform/depency.<env>.yml` (e.g. `depency.production.yml`)
3. Fallback: `src/platform/depency.yml`

### How Generation Works

1. `scripts/di-generator.ts` scans `src/platform/` (single root) for `@injectable('ServiceId', 'Scope')` classes.
2. Naming convention per class:
   - `*Server` → included only in `server.ts`
   - `*SSR` → included only in `ssr.ts`
   - `*Client` → included in `client.ts` **only if** `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is `true` / `1` / `yes` when `npm run generate` runs; otherwise not emitted
   - No suffix → **common**: included in both `server.ts` and `ssr.ts` unless an environment-specific class for the same id replaces it; when client generation is enabled, common bindings also appear in `client.ts` per generator rules
3. It always generates **two** files, and **optionally a third**:
   - `src/platform/server.ts` — `import 'server-only'`; API routes, middleware, `lib/server`, etc.
   - `src/platform/ssr.ts` — `import 'server-only'`; Server Components and `src/lib/ssr/*`
   - `src/platform/client.ts` — **only when** `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is enabled; **no** `server-only` import (browser bundle)
4. If client generation is **disabled** after it was previously enabled, the next `npm run generate` **removes** `client.ts` if present.
5. Each file statically imports all bound modules and applies aliases from `depency.yml` where configured.

After a production build, `npm run verify:client-chunks` checks that known Emporix integration symbols do not appear under `.next/static/chunks` (run manually or in CI if needed).

### Container Initialization

Containers are initialized in different ways depending on the environment:

1. **Server Container**: Initialized through Next.js instrumentation in `src/instrumentation.ts` (`src/platform/server.ts`, `import 'server-only'`)
2. **SSR Container**: Used from Server Components and SSR libs (`src/platform/ssr.ts`, `import 'server-only'`)
3. **Browser**: **Default:** no DI container — use `getLogger()` from `@/lib/logger/browser-logger` (or `@/lib/logger/use-logger-client`), `getValidator(id)` from `@/lib/client/validation-registry`, and API routes for Emporix-backed work. **Opt-in:** use the generated `src/platform/client.ts` container when `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is enabled (same env is read by ESLint to allow `@/platform/client` imports).

### Watch Mode

The watch mode feature:

1. Efficiently handles initial file scanning without triggering unnecessary regeneration
2. Uses the Chokidar library for reliable file monitoring
3. Only regenerates containers when actual changes are detected

## Client components (browser)

Do **not** import `@/platform/server` or `@/platform/ssr` from Client Components or other browser bundles (those entry modules are `server-only`). ESLint blocks `@/platform/client` unless `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is enabled (same truthy values as the generator). `@/lib/client/service` remains blocked.

**Logging**

```typescript
import { getLogger } from '@/lib/logger/browser-logger';
// or: import { getLogger } from '@/lib/logger/use-logger-client';

const logger = getLogger();
logger.info({ cartId }, 'Cart loaded');
```

**Form validation (Zod schemas shared with server)**

Validators are registered in `@/lib/client/validation-registry` with the same service IDs as server-side `@injectable` classes. `useValidator('LoginValidationService', …)` resolves against that registry. Schemas live in `@/lib/validation/form-schemas` and are imported by server validation services to avoid drift.

**Emporix / business logic**

Call `fetch('/api/…')` or Server Actions; resolve services with `server.get` / `ssr.get` only in server modules.

## Best Practices

1. **Always define interfaces**: Create clear contracts for your services.
2. **Use meaningful identifiers**: The ID in `@injectable('ServiceId')` should be descriptive.
3. **Prefer constructor injection**: This makes dependencies explicit and enables proper testing.
4. **Consider lifecycle scopes**: Use 'Singleton' for stateless services and 'Transient' for stateful ones.
5. **Follow naming conventions**: Use suffixes to indicate environment specificity:
   - `ServiceClient.ts` for client-only implementations
   - `ServiceServer.ts` for server-only implementations
   - `ServiceSSR.ts` for SSR-specific implementations
6. **Avoid duplicate service IDs**: Each service ID should be unique across all environments.

## Container Registry

The container registry has been enhanced to handle duplicate service registrations gracefully. If a service with the same ID is registered multiple times, the latest registration will take precedence. This is particularly useful during development when files are being updated frequently.

```typescript
// Prevent duplicate identifiers
if (container.isBound(identifier)) {
  container.unbind(identifier);
}
container.bind(identifier).to(module);
```

## Instrumentation Integration

The DI containers are initialized during the Next.js bootstrap process using the instrumentation API. This ensures that containers are available throughout the application lifecycle, including during server-side rendering.

The initialization happens in `src/instrumentation.ts`:

```typescript
export function register() {
  // Initialize the server container
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // This code runs only on the server
    import('./platform/server');
  }
}
```

## Usage Examples: Server vs. SSR Containers

Understanding when to use each container type is crucial for proper application architecture. Here are examples from our codebase:

### SSR Container Usage

The SSR container is used in server components that render pages. It's accessed through direct imports from `@/platform/ssr`. This is ideal for Next.js Server Components that need to fetch data during rendering.

**Example from `src/lib/ssr/products.ts`:**

```typescript
import { cache } from 'react';
import { Product } from '@/platform/services/model/product';
import { ProductService } from '@/platform/services/product';
import ssr from '@/platform/ssr';

// Access the ProductService from the SSR container
const getProductService = () => ssr.get<ProductService>('ProductService');

// Use React's cache to memoize product fetching
const _getProduct = cache(async (id: string): Promise<Product | null> => {
  const product = await getProductService().getProductById(id);
  return product || null;
});

export function getProductById(id: string): Promise<Product | null> {
  return _getProduct(id);
}
```

This is then used in a Server Component like `src/app/[site]/[locale]/(default)/product/[id]/page.tsx`:

```typescript
// Fetch product data server-side using the SSR container
let product: Product | null;
try {
  product = await getProductById(productId);
} catch (error) {
  throw new Error(`Error loading product: ${error instanceof Error ? error.message : String(error)}`);
}
```

### Server Container Usage

The Server container is used in API routes and other server-only code that doesn't participate in rendering. It's accessed through direct imports from `@/platform/server`.

**Example from `src/app/api/products/[id]/route.ts`:**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/platform/services/product/ProductService';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: productId } = await params;

    // Access the ProductService directly from the server container
    const productService = server.get<ProductService>('ProductService');
    const product = await productService.getProductById(productId);

    if (!product) {
      return NextResponse.json({ error: `Product with ID ${productId} not found` }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    const logger = server.get<LoggerService>('LoggerService');
    logger.error({ error }, 'Error fetching product');
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
```

### When to Use Which Container

| Container  | Use Case                                 | Access Pattern                           | Example Scenarios                                         |
| ---------- | ---------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| **SSR**    | Server Components, RSC data fetching     | `import ssr from '@/platform/ssr'`<br/>`ssr.get<T>(id)` | Product pages, category listings, server-rendered content |
| **Server** | API routes, middleware, server utilities | `import server from '@/platform/server'`<br/>`server.get<T>(id)` | REST endpoints, authentication, server-only operations    |
| **Browser** | Client Components, browser-only code   | **Default:** `lib/client/*`, `fetch('/api/…')` — **Opt-in:** `import client from '@/platform/client'` when `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT` is set and containers are regenerated | Forms (Zod registry), logging, interactive UI; optional Inversify in forks |

## Conclusion

Our Dependency Injection framework always covers **server** and **SSR** Node runtimes. **By default** the browser stays free of the Inversify integration/service graph for smaller bundles and safer defaults. Use `server.get` / `ssr.get` on the server and thin `lib/client` helpers plus `/api/*` in the browser. Forks that need a browser container can enable `NEXT_PUBLIC_ENABLE_DI_GENERATE_CLIENT`, regenerate, and use the emitted `client.ts` with appropriate security review.
