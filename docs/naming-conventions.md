# Naming Conventions
The Storefront's code follows some naming conventions which have provide a mix of common practices and custom rules that aim to improve ease of use and readability.

## Platform Naming

We follow a set of Rules to make our codebase more readable and maintainable. Some of the rules are not coherent with common Naming Conventions, but due to the architectural choices of the platform, we have to deviate from them.

Most of these rules aim to make it easier to understand with which layer of the platform a piece of code is interacting and maintain the loose coupling.

### Naming Integrations

Integrations should be declared in a .d.ts File that follows the pattern (Integration)Api.d.ts like "EmporixCartApi.d.ts" or "EmporixProductApi.d.ts".

The interface's name should be in PascalCase and end with "Api".

Implementations should be declared in a .ts File that follows the pattern (Integration)Api.ts like "EmporixCartApi.ts" or "EmporixProductApi.ts".

The implementation's name should be in PascalCase and end with "Api".

Inside the implementation the interface should be aliased as I(Integration)(Domain)Api like "IEmporixCartApi" or "IEmporixProductApi".

The reason behind this, is to reduce clutter in naming like "DefaultEmporixCartApi" or "EmporixCartApiImpl".

Example:

```typescript
// EmporixCartApi.d.ts
export interface EmporixCartApi {
  // ...
}

// EmporixCartApi.ts
import type { EmporixCartApi as IEmporixCartApi } from './EmporixCartApi.d';

export class EmporixCartApi implements IEmporixCartApi {
  // ...
}
```

#### Models
Data Models like Types and Interfaces should be declared in separate .d.ts files and should always be named like (Integration)(Model) like "EmporixCart" or "EmporixProduct".

We do this to avoid confusion with Business/Service layer models, which would usually be just name "Product" or "Cart", this clearly benefits Autotyping and improves the compatibility with AI-Tools for prompting.

### Naming Services

Interfaces should be declared in a .d.ts File that follows the pattern (Domain)Service.d.ts like "CartService.d.ts" or "ProductService.d.ts".

The interface's name should be in PascalCase and end with "Service".

Implementations should be declared in a .ts File that follows the pattern (Integration)(Domain)Service.ts like "EmporixCartService.ts" or "EmporixProductService.ts".

The implementation's name should be in PascalCase and end with "Service".

The reason behind this, is to provide a clear distinction between the generic business-level interface and the Integration-specific implementation.

Example:

```typescript
// CartService.d.ts
export interface CartService {
  // ...
}

// EmporixCartService.ts
import type { CartService } from './CartService.d';

export class EmporixCartService implements CartService {
  // ...
}
```

## Related Documentation

- [Documentation index](./README.md)
- [Layered Architecture](./layered-architecture.md)
- [Dependency Injection](./dependency-injection.md)
- [Storyblok Integration](./storyblok-integration.md)
