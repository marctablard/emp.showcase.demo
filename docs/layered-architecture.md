# Layered Architecture Documentation

## Overview

Our application follows a layered architecture pattern that separates concerns into distinct layers: Integrations, Services, and Repositories. This architectural approach provides a clear separation of responsibilities, making the codebase more maintainable, testable, and adaptable to change.

## Why Use a Layered Architecture?

A layered architecture offers several key benefits:

1. **Separation of Concerns**: Each layer has a specific responsibility, making the code more organized and easier to understand.

2. **Testability**: Layers can be tested in isolation, enabling more effective unit testing.

3. **Flexibility**: Implementation details in one layer can be changed without affecting other layers.

4. **Maintainability**: Clear boundaries between layers make it easier to locate and fix issues.

5. **Scalability**: New features can be added by extending existing layers rather than modifying them.

## Our Three-Layer Architecture

Our application is divided into three primary layers, each with its own specific responsibilities:

### 1. Integration Layer

The Integration layer serves as the entry point for external interactions with our application.

**Responsibilities:**

- Handling HTTP requests and responses
- Input validation and sanitization
- Authentication and authorization
- Routing requests to the appropriate service
- Formatting responses according to API contracts

**Example Use Cases:**

- REST API endpoints
- GraphQL resolvers
- External API clients (e.g., Emporix API integration)

The Integration layer should not contain business logic; it should delegate to the service layer for processing.

### 2. Service Layer

The service layer contains the core business logic of our application.

**Responsibilities:**

- Implementing business rules and workflows
- Coordinating operations across multiple repositories
- Transaction management
- Domain-specific logic
- Transforming data between the Integration and repository layers

**Example Use Cases:**

- Cart management logic
- Product search and filtering
- User authentication workflows
- Content management operations

Services should be independent of the Integration layer and should not directly interact with data storage mechanisms.

## Layer Interaction

The layers interact in a unidirectional flow:

```
Integration Layer → Service Layer ← React Application Level
```

Each layer only communicates with adjacent layers:

- Service Layer depends on the Integration layer
- React Application layer depends on the Service layer

This unidirectional dependency flow ensures that:

- Higher layers can be replaced without affecting lower layers
- Lower layers can be modified without impacting higher layers
- Testing can be performed in isolation at each layer

## Implementation in Our DI Framework

The active generator is `scripts/di-generator.ts`. It scans **`src/platform/` as one tree** (integrations, services, repositories, etc.) and emits:

- `src/platform/server.ts` — server-only container (`import 'server-only'`)
- `src/platform/ssr.ts` — SSR / RSC container (`import 'server-only'`)

There is **no** generated per-layer `index.ts` container and **no** browser Inversify bundle. See `docs/dependency-injection.md` for details.

`src/platform/integrations/index.ts` is a **manual placeholder** (server-only) for possible future integration wiring; it is not part of `npm run generate`.

The legacy script `scripts/di-generator-core.ts` described a per-layer `outputFile` layout; that path is not used by `npm run generate` today.

## Practical Examples

### Example 1: Product Feature Flow

Let's consider a get product feature:

**Integration Layer** (`src/platform/integrations/emporix/product/impl/EmporixProductApi.ts`):

- Handles HTTP requests to Emporix API, calling https://api.emporix.io/product/{tenant}/products/{productId}
- Formats the request and response according to the API contract

**Service Layer** (`src/platform/services/product/impl/EmporixProductService.ts`):

- Invokes EmporixProductApi from Integration layer
- Handles product data transformation and validation
- Applies business rules (e.g., visibility, availability)
- Transforms raw data into domain models through Mappers

**React Application Level** (`src/app/[site]/[locale]/(default)/product/[id]/page.tsx`):

- Invokes EmporixProductService from Service layer either directly or through Next-API
- Renders the product data in the UI

### Example 2: Next.js API Route

Here's how our layered architecture is implemented in a Next.js API route:

**Next.js API Route** (`src/app/api/products/[id]/route.ts`):

```typescript
import { NextRequest, NextResponse } from 'next/server';
import server from '@/platform/server';
import type { LoggerService } from '@/platform/services/logger/LoggerService';
import { ProductService } from '@/platform/services/product/ProductService';

/**
 * API endpoint to get a specific product by ID
 * GET /api/products/[id]
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const productId = params.id;
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

This example demonstrates:

- The Next.JS API route just uses the Service layer
- It has no knowledge of the Integration layer and must only deal with the Service Layers Data Model
- It uses our dependency injection system to get the appropriate service
- This way the React/Next application can be developed independently of the underlying Platform

## Benefits of Our Layered Approach

### 1. Adaptability to Different Implementations

Our layered architecture, combined with dependency injection, allows us to easily swap implementations:

```typescript
// Integration Layer can have multiple implementations
@injectable('ProductApi')
class EmporixProductApi implements ProductApi {
  /* ... */
}

@injectable('ProductApi')
class MockProductApi implements ProductApi {
  /* ... */
}
```

### 2. Environment-Specific Code

Different layers may need different implementations based on the environment:
We can supply different implementations for each environment by Naming convention.
- ...Client : used in Client/Browser-Context
- ...Server : used in Server-Side-Context
- ...SSR : used in Server-Side-Rendering-Context

```typescript
// Service Layer with client/server variants
@injectable('UserService')
class UserServiceServer implements UserService {
  /* ... */
}

@injectable('UserService')
class UserServiceClient implements UserService {
  /* ... */
}

@injectable('UserService')
class UserServiceSSR implements UserService {
  /* ... */
}
```

### 3. Testing Simplification

Layers can be tested in isolation with mocks:

```typescript
// Testing a service with a mocked repository
const mockRepository = { findById: jest.fn() };
const service = new ProductService(mockRepository);
// Test service behavior
```

## Best Practices

1. **Maintain Layer Boundaries**: Don't skip layers or create circular dependencies.

2. **Keep Layers Focused**: Each layer should have a single responsibility.

3. **Use Interfaces**: Define clear contracts between layers using interfaces.

4. **Avoid Leaky Abstractions**: Don't expose implementation details of one layer to another.

5. **Follow Naming Conventions**: Use consistent naming patterns for each layer.

## Conclusion

Our layered architecture provides a solid foundation for building complex applications. By clearly separating concerns into Integration, Service, and Repository layers, we create a codebase that is easier to understand, test, and maintain. Combined with our dependency injection framework, this architecture enables us to build flexible, modular, and robust applications.
