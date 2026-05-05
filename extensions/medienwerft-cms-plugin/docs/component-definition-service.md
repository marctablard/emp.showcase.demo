# CMS Component Service

## Overview

The `CMSComponentService` provides **true loose coupling** through **dependency inversion**. The CMS extension defines the interface (what it needs), and the storefront provides the implementation (how to fulfill that need).

This follows the **Dependency Inversion Principle**: high-level modules (the extension) should not depend on low-level modules (specific components), but both should depend on abstractions (the interface).

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CMS Extension (High-Level)                │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  services/CMSComponentService.d.ts                     │ │
│  │  - DEFINES the interface (contract)                    │ │
│  │  - Specifies what the extension needs                  │ │
│  │  - Owned by the extension                              │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ▲                                  │
│                            │ depends on abstraction           │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  EmporixCMSComponentRenderer                           │ │
│  │  - Gets service from DI: client.get(...)              │ │
│  │  - Calls getDefinition(type)                           │ │
│  │  - Renders components dynamically                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└────────────────────────────┬─────────────────────────────────┘
                             │ DI Container
                             │ implements abstraction
┌────────────────────────────┼─────────────────────────────────┐
│                    Storefront Application (Low-Level)        │
│                            │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Storefront CMSComponentService implementation         │ │
│  │  - IMPLEMENTS the interface                            │ │
│  │  - Registered as 'EmporixCMSComponentService' in DI    │ │
│  │  - Provides definitions, mappers, and React components │ │
│  └────────────────────────────────────────────────────────┘ │
│                            ▲                                  │
│                            │                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  src/components/cms/emporix/definitions/index.ts       │ │
│  │  - Defines all CMS components                          │ │
│  │  - Maps component types to implementations             │ │
│  │  - Exports cmsDefinitionMap                            │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Benefits

### 1. **True Dependency Inversion** ⭐
- **Extension owns the interface** - Defines what it needs
- **Storefront implements the interface** - Provides what's needed
- **Both depend on abstraction** - Neither depends on the other's concrete implementation
- **High-level module (extension) doesn't depend on low-level module (components)**

### 2. **Loose Coupling**
The extension doesn't need to know where component definitions come from or how they're structured. It just requests them from the DI container.

### 3. **Flexibility**
Different storefronts can provide completely different component implementations by registering their own `CMSComponentService`.

### 4. **Testability**
Easy to mock the service for testing without needing actual component implementations.

### 5. **Extensibility**
New components can be added to the storefront without modifying the extension code.

### 6. **Portability**
The extension can be used with any storefront that implements the `CMSComponentService` interface.

## Service Interface

```typescript
export interface CMSComponentService {
  /**
   * Get all registered component definitions.
   * @returns An array of component entries (definition, mapProps, component)
   */
  getDefinitions(): CMSComponentEntry[];

  /**
   * Get a specific component definition by type.
   * @param type The component type identifier
   * @returns The component entry or undefined if not found
   */
  getDefinition(type: string): CMSComponentEntry | undefined;

  /**
   * Get all registered component types.
   * @returns Array of component type identifiers
   */
  getComponentTypes(): string[];
}
```

**Note:** `CMSComponentEntry` now includes three fields: `definition`, `mapProps`, and `component` (the React component).

## Usage in Extension

### Client Components

```typescript
'use client';

import client from '@/platform/client';
import type { CMSComponentService } from '@extensions/medienwerft-cms-plugin/services/CMSComponentService';

export default function MyComponent() {
  // Get the service from DI
  const definitionService = client.get<CMSComponentService>(
    'EmporixCMSComponentService'
  );
  
  // Get all definitions
  const definitions = definitionService.getDefinitions();
  
  // Get a specific definition
  const heroDefinition = definitionService.getDefinition('hero');
  
  // Get all component types
  const types = definitionService.getComponentTypes();
  
  // Use the definitions...
}
```

### Server Components

```typescript
import ssr from '@/platform/ssr';
import type { CMSComponentService } from '@extensions/medienwerft-cms-plugin/services/CMSComponentService';

export default async function MyServerComponent() {
  // Get the service from DI
  const definitionService = ssr.get<CMSComponentService>(
    'EmporixCMSComponentService'
  );
  
  // Get component types for metadata
  const types = definitionService.getComponentTypes();
  
  // Use the types...
}
```

## Implementing Your Own Service

If you want to provide a custom set of component definitions:

### 1. Create Your Implementation

```typescript
// src/platform/services/cms/impl/MyCustomComponentService.ts
import { injectable } from '@/platform/core/di/injectable';
import type { CMSComponentService } from '@extensions/medienwerft-cms-plugin/services/CMSComponentService';
import type { CMSComponentEntry } from '@extensions/medienwerft-cms-plugin/types';

@injectable('EmporixCMSComponentService', 'Singleton')
export class MyCustomComponentService implements CMSComponentService {
  private definitions: CMSComponentEntry[];

  constructor() {
    // Initialize with your custom definitions
    this.definitions = [
      // Your component entries here (definition + mapProps + component)
    ];
  }

  getDefinitions(): CMSComponentEntry[] {
    return this.definitions;
  }

  getDefinition(type: string): CMSComponentEntry | undefined {
    return this.definitions.find(e => e.definition.type === type);
  }

  getComponentTypes(): string[] {
    return this.definitions.map(e => e.definition.type);
  }
}

export default MyCustomComponentService;
```

### 2. Register in DI Container

The DI generator will automatically discover and register your service if:
- It's decorated with `@injectable('EmporixCMSComponentService', ...)`
- It's in the correct directory structure
- It follows the naming conventions (e.g., `*Client.ts`, `*Server.ts`, `*SSR.ts`)

### 3. Rebuild

```bash
npm run generate-di
npm run dev
```

## Service Variants

The service can have different implementations for different environments by using the DI naming convention suffixes:

- **`*Service.ts`** - Universal (works everywhere)
- **`*ServiceClient.ts`** - Client-only
- **`*ServiceSSR.ts`** - SSR-only
- **`*ServiceServer.ts`** - Server-only

The DI container will automatically use the appropriate variant based on the environment.

## Migration from Direct Imports

### Before (Tight Coupling)

```typescript
import { cmsDefinitionMap } from '@/components/cms/emporix/definitions';

export default function MyComponent() {
  const definitions = cmsDefinitionMap;
  // Use definitions...
}
```

### After (Loose Coupling)

```typescript
import client from '@/platform/client';
import type { CMSComponentService } from '@extensions/medienwerft-cms-plugin/services/CMSComponentService';

export default function MyComponent() {
  const definitionService = client.get<CMSComponentService>(
    'EmporixCMSComponentService'
  );
  const definitions = definitionService.getDefinitions();
  // Use definitions...
}
```

## Best Practices

### 1. **Always Use the Service**
Don't import `cmsDefinitionMap` directly in extension code. Always use the service.

### 2. **Cache When Appropriate**
The service returns the same object reference, so you can safely use it in React dependencies:

```typescript
const definitions = definitionService.getDefinitions();
const types = useMemo(() => Object.keys(definitions), [definitions]);
```

### 3. **Handle Missing Definitions**
Always check if a definition exists before using it:

```typescript
const definition = definitionService.getDefinition(componentType);
if (!definition) {
  logger.warn({ componentType }, 'Component type not found');
  return null;
}
```

### 4. **Type Safety**
Always use the TypeScript types provided by the service interface.

## Troubleshooting

### Service Not Found

If you get an error like "Service 'EmporixCMSComponentService' not found":

1. Ensure the service is registered in the DI container
2. Run `npm run generate-di` to regenerate the container
3. Check that the service file is in the correct location
4. Verify the `@injectable` decorator is present

### Wrong Environment

If the service works in one environment but not another:

1. Check if you need environment-specific variants
2. Create `*Client.ts`, `*Server.ts`, or `*SSR.ts` versions as needed
3. Regenerate the DI container

### Stale Definitions

If component changes aren't reflected:

1. Restart the development server
2. Clear Next.js cache: `rm -rf .next`
3. Rebuild: `npm run dev`

## See Also

- [Architecture Overview](./architecture.md)
- [Dependency Injection Documentation](../../../docs/dependency-injection.md)
- [CMS Component Definitions](./component-definitions.md)
- [Extension Development Guide](../../README.md)
