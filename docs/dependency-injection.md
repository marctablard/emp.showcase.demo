# Dependency Injection Framework Documentation

## Overview

Our Dependency Injection (DI) framework provides a robust, type-safe way to manage dependencies throughout the Emporix Showcase application. It enables loose coupling between components, making the codebase more maintainable, testable, and flexible.

## Why Dependency Injection?

1. **Separation of Concerns**: Each component focuses on its specific functionality without worrying about how its dependencies are created or managed.

2. **Testability**: Dependencies can be easily mocked during testing, allowing for isolated unit tests.

3. **Code Reusability**: Services and components can be reused across different parts of the application.

4. **Environment-Specific Implementations**: The framework supports different implementations for client, server, and SSR environments, critical for Next.js applications.

5. **Centralized Configuration**: All service registrations are managed in one place, making it easier to understand and modify the application's architecture.

## Technical Foundation

Our DI framework is built on [InversifyJS](https://inversify.io/), a powerful inversion of control container for TypeScript & JavaScript applications. We've extended Inversify with custom functionality to support:

- Automatic container generation
- Environment-specific implementations (client, server, and SSR)
- Unified platform container with environment-specific variants
- File watching for development

## Core Principles

1. **Interface-Based Design**: Services are defined by interfaces, allowing for multiple implementations.

2. **Unified Platform Container**: The application provides a platform container that includes all layers (Integrations, Services, Repositories) with environment-specific variants.

3. **Environment Awareness**: The framework allows to selects the appropriate implementation based on the execution environment (client, server, or SSR).

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
import { injectable } from '@/integration/common/di/injectable';

@injectable('UserAgentService', 'Singleton')
class UserAgentServiceServer implements UserAgentService {
  async getUserAgent(): Promise<string> {
    const headersList = await headers();
    return headersList.get('user-agent') || 'No UserAgent supplied on Request';
  }
}

export default UserAgentServiceServer;
```

#### Client Implementation

```typescript
// src/platform/services/hello/impl/UserAgentServiceClient.ts
import type { UserAgentService } from '../UserAgentService';
import { injectable } from '@/integration/common/di/injectable';

@injectable('UserAgentService', 'Singleton')
export class UserAgentServiceClient implements UserAgentService {
  getUserAgent(): Promise<string> {
    return Promise.resolve(window.navigator.userAgent);
  }
}
```

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
import { injectable } from '@/integration/common/di/injectable';
import type { UserAgentService } from '../UserAgentService';
import { inject } from 'inversify';

@injectable('HelloService', 'Singleton')
class HelloAgentService implements HelloService {
  constructor(@inject('UserAgentService') private userAgentService: UserAgentService) {}

  async sayHello(): Promise<string> {
    try {
      const userAgent = await this.userAgentService.getUserAgent();

      return `Hello Agent! Your browser agent is: ${userAgent}`;
    } catch (error) {
      console.error('Error reading server-only file:', error);
      return 'Hello Server Error (file could not be read)';
    }
  }
}

export default HelloAgentService;
```

### Why Different Implementations Are Necessary

In our example with `UserAgentService`, we have separate implementations for client, server, and SSR because:

1. **Server-Side Rendering**: In server components, we need to access the user agent from the request headers.
2. **Client-Side Execution**: In the browser, we access the user agent from the `window.navigator` object.
3. **SSR-Specific Logic**: Some components need special handling during server-side rendering.
4. **Code Splitting**: Environment-specific code should not be included in bundles where it's not needed.
5. **Environment-Specific APIs**: Some APIs are only available in specific environments.

The DI framework automatically selects the correct implementation based on the execution context, making the code that consumes these services simpler and more maintainable.

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

### How Generation Works

1. The generator scans directories for TypeScript files with `@injectable` decorators.
2. It identifies which environment each injectable belongs to based on naming conventions:
   - Classes ending with `Server` are server-only
   - Classes ending with `Client` are client-only
   - Classes ending with `SSR` are SSR-only
   - Classes with no specific suffix are common to all environments
3. It generates three container files:
   - `server.ts`: For server-only and common implementations
   - `client.ts`: For client-only and common implementations
   - `ssr.ts`: For SSR-only and common implementations
4. Each container file:
   - Imports all relevant modules
   - Registers them with the appropriate container
   - Provides a type-safe way to resolve dependencies

### Container Initialization

Containers are initialized in different ways depending on the environment:

1. **Server Container**: Initialized through Next.js instrumentation in `src/instrumentation.ts`
2. **Client Container**: Initialized in client components through a provider
3. **SSR Container**: Initialized during server-side rendering

### Watch Mode

The watch mode feature:

1. Efficiently handles initial file scanning without triggering unnecessary regeneration
2. Uses the Chokidar library for reliable file monitoring
3. Only regenerates containers when actual changes are detected

## Using Services in Client Components

To access services from the DI container in client components or hooks, use the `getService` helper function:

```typescript
// src/hooks/example/useMyHook.ts
'use client';

import { getService } from '@/lib/client/service';
import type { MyService } from '@/platform/services/my-service/MyService';

export function useMyHook() {
  // Get the service from the DI container
  const myService = getService<MyService>('MyService');
  
  // Use the service
  const result = myService.doSomething();
  
  return { result };
}
```

The `getService` function is a simple wrapper around the client container's `get` method:

```typescript
// src/lib/client/service.ts
'use client';

import client from '@/platform/client';

export const getService = <T>(serviceId: string): T => {
  return client.get<T>(serviceId);
};
```

This approach ensures that:

1. The correct implementation is used based on the execution environment
2. Services are properly instantiated and managed by the DI container
3. Singleton services are shared across the application
4. Dependencies are automatically injected into services

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

This is then used in a Server Component like `src/app/[locale]/product/[id]/page.tsx`:

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
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Failed to fetch product' }, { status: 500 });
  }
}
```

### When to Use Which Container

| Container  | Use Case                                 | Access Pattern                           | Example Scenarios                                         |
| ---------- | ---------------------------------------- | ---------------------------------------- | --------------------------------------------------------- |
| **SSR**    | Server Components, RSC data fetching     | `import ssr from '@/platform/ssr'`<br/>`ssr.get<T>(id)` | Product pages, category listings, server-rendered content |
| **Server** | API routes, middleware, server utilities | `import server from '@/platform/server'`<br/>`server.get<T>(id)` | REST endpoints, authentication, server-only operations    |
| **Client** | Client Components, browser-only code     | Injected via context providers           | Interactive UI elements, client-side state management     |

## Migration from Global EMP Pattern

Previously, the application used a global `EMP.platform` object to access containers. This pattern has been migrated to direct imports for better type safety and cleaner code organization.

### Old Pattern (Deprecated)
```typescript
// ❌ Old way - no longer supported
const productService = globalThis.EMP.platform.ssr.get<ProductService>('ProductService');
const orderService = EMP.platform.server.get<OrderService>('OrderService');
```

### New Pattern (Current)
```typescript
// ✅ New way - direct imports
import ssr from '@/platform/ssr';
import server from '@/platform/server';

const productService = ssr.get<ProductService>('ProductService');
const orderService = server.get<OrderService>('OrderService');
```

### Benefits of the New Pattern
- **Better Type Safety**: Direct imports provide better TypeScript intellisense and error checking
- **Cleaner Dependencies**: Explicit imports make dependencies clear and trackable
- **No Global State**: Eliminates reliance on global objects, making code more predictable
- **Tree Shaking**: Bundlers can better optimize unused imports
- **Easier Testing**: Direct imports are easier to mock and test

## Conclusion

Our Dependency Injection framework provides a solid foundation for building maintainable, testable, and flexible applications. The unified platform container with environment-specific variants simplifies dependency management while maintaining the flexibility needed for a Next.js application. By following the patterns and practices outlined in this documentation, you can leverage the full power of dependency injection in your application.
