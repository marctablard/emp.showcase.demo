# Storefront Extensions

This directory contains extensions that enhance the core functionality of the Emporix Journey Aware Storefront. Extensions provide a modular way to add features, integrate with external services, or customize behavior without modifying the core application code.

## Overview

Extensions are self-contained modules that can:
- Add new services and integrations
- Provide React components
- Register dependency injection bindings
- Define setup/seed data
- Override or extend existing functionality

## Installing Pre-Built Extensions

Pre-built extensions are distributed as compressed archives (`.zip` or `.tar.gz`). To install:

1. **Download** the extension package
2. **Extract** the archive into the `extensions/` directory
3. **Verify** the structure - each extension should be in its own subdirectory with a `plugin.json` manifest
4. **Enable** the extension by setting `"enabled": true` in `plugin.json`
5. **Restart** the development server or rebuild the application

Example structure after installation:
```
extensions/
├── .gitkeep
├── emporix-cms-plugin/
│   ├── plugin.json
│   ├── components/
│   ├── services/
│   └── ...
└── my-custom-extension/
    ├── plugin.json
    └── ...
```

## Extension Structure

Each extension must follow this structure:

```
extensions/
└── your-extension-name/
    ├── plugin.json                    # Required: Extension manifest
    ├── components/                    # Optional: React components
    │   ├── index.ts                   # Export public components
    │   └── *.tsx                      # Component implementations
    ├── services/                      # Optional: Business logic services
    │   └── impl/
    │       └── *Service.ts            # Service implementations with @injectable
    ├── integrations/                  # Optional: External API integrations
    │   ├── *.d.ts                     # Integration interfaces
    │   └── impl/
    │       └── *Api.ts                # API implementations with @injectable
    ├── hooks/                         # Optional: React hooks
    │   └── *.ts
    ├── setup/                         # Optional: Setup and seed data
    │   └── *.json                     # Entity schemas, seed data
    └── docs/                          # Optional: Documentation
        └── *.md
```

## The `plugin.json` Manifest

Every extension **must** include a `plugin.json` file at its root. This manifest defines the extension's metadata and configuration.

### Required Fields

```json
{
  "name": "your-extension-name",
  "description": "Brief description of what this extension does",
  "version": "1.0.0",
  "enabled": true
}
```

### Optional Fields

```json
{
  "name": "emporix-cms-plugin",
  "description": "CMS page management backed by Emporix Custom Entities",
  "version": "1.0.0",
  "enabled": true,
  
  "aliases": {
    "CMSService": "EmporixCMSService"
  },
  
  "setup": [
    "setup/cms-page-entity.json",
    "setup/cms-page-seed.json"
  ]
}
```

#### Field Descriptions

- **`name`** (required): Unique identifier for the extension. Use kebab-case.
- **`description`** (required): Human-readable description of the extension's purpose.
- **`version`** (required): Semantic version number (e.g., "1.0.0").
- **`enabled`** (required): Boolean flag to enable/disable the extension without removing it.
- **`aliases`** (optional): Map of service interface IDs to implementation IDs for dependency injection overrides.
- **`setup`** (optional): Array of file paths (relative to extension root) containing setup/seed data.

## Dependency Injection Integration

Extensions integrate seamlessly with the storefront's dependency injection system using InversifyJS.

### Creating Injectable Services

Services and integrations in extensions use the `@injectable` decorator:

```typescript
// extensions/my-extension/services/impl/MyServiceSSR.ts
import { inject } from 'inversify';
import { injectable } from '@/platform/core/di/injectable';
import type { MyService } from '@/platform/services/my-service/MyService';

@injectable('MyCustomService', 'Singleton')
export class MyCustomServiceSSR implements MyService {
  constructor(
    @inject('LoggerService') private logger: LoggerService,
    @inject('SomeOtherService') private otherService: SomeOtherService
  ) {}

  async doSomething(): Promise<void> {
    this.logger.info('Doing something from extension');
    // Implementation
  }
}

export default MyCustomServiceSSR;
```

### Service Naming Conventions

Follow these naming patterns for environment-specific services:

- **`*SSR.ts`** - Server-side rendering services (runs during SSR)
- **`*Server.ts`** - Server-only services (API routes, server actions)
- **`*Client.ts`** - Client-only services (browser environment)
- **No suffix** - Universal services (work in all environments)

### Service Aliases

Use the `aliases` field in `plugin.json` to override core services:

```json
{
  "aliases": {
    "CMSService": "EmporixCMSService"
  }
}
```

This tells the DI container: "When something requests `CMSService`, give them `EmporixCMSService` instead."

**Use cases:**
- Replace a default implementation with an extension-specific one
- Provide alternative integrations (e.g., different payment providers)
- Override behavior for specific environments

## Auto-Discovery

The storefront automatically discovers and registers extensions during the build process:

1. **Scan**: The DI generator (`scripts/di-generator.ts`) scans the `extensions/` directory
2. **Validate**: Each subdirectory is checked for a valid `plugin.json`
3. **Filter**: Only extensions with `"enabled": true` are processed
4. **Register**: Injectable classes are automatically added to the DI container
5. **Alias**: Service aliases are applied to the container

No manual registration is required - just add your extension and rebuild!

## Creating Components

Extensions can provide React components that the storefront can use.

### Component Export Pattern

```typescript
// extensions/my-extension/components/index.ts
/**
 * Component registry for my-extension.
 * 
 * Exports React components that can be used by the host application
 * or by other extensions. Import from '@extensions/my-extension/components'.
 */

export { default as MyCustomComponent } from './my-custom-component';
export { default as AnotherComponent } from './another-component';
```

### Using Extension Components

In the storefront application:

```typescript
import { MyCustomComponent } from '@extensions/my-extension/components';

export default function MyPage() {
  return <MyCustomComponent />;
}
```

### TypeScript Path Mapping

Extension imports use the `@extensions/*` path alias defined in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@platform/*": ["./src/platform/*"],
      "@extensions/*": ["./extensions/*"]
    }
  }
}
```

## Setup and Seed Data

Extensions can provide setup files for entity schemas and seed data.

### Setup File Format

Reference setup files in `plugin.json`:

```json
{
  "setup": [
    "setup/my-entity-schema.json",
    "setup/my-seed-data.json"
  ]
}
```

### Entity Schema Example

```json
{
  "type": "MY_CUSTOM_ENTITY",
  "mixins": [
    {
      "key": "MY_ENTITY_DATA",
      "attributes": [
        {
          "name": "title",
          "type": "string",
          "required": true
        },
        {
          "name": "content",
          "type": "text"
        }
      ]
    }
  ]
}
```

## Dependency Inversion Pattern

Extensions can define service interfaces that the storefront must implement. This achieves **true loose coupling** through the **Dependency Inversion Principle**.

### Example: CMSComponentDefinitionService

```
Extension (High-Level)              Storefront (Low-Level)
┌─────────────────────┐            ┌──────────────────────┐
│ Defines Interface   │            │ Implements Interface │
│ CMSComponentDef...  │◄───────────│ StorefrontCMSDef...  │
│                     │  implements│                      │
│ Uses via DI:        │            │ Provides:            │
│ client.get(...)     │            │ @injectable(...)     │
└─────────────────────┘            └──────────────────────┘
```

**Benefits:**
- Extension owns the contract (interface)
- Storefront fulfills the contract (implementation)
- Extension is portable to any storefront that implements the interface
- No tight coupling between extension and storefront

**Example:**

```typescript
// Extension defines what it needs
// extensions/my-extension/MyService.d.ts
export interface MyService {
  getData(): Promise<Data>;
}

// Extension uses it
import type { MyService } from '../MyService';
const service = client.get<MyService>('MyService');

// Storefront implements it
// src/platform/services/my-service/impl/MyServiceImpl.ts
@injectable('MyService', 'Singleton')
export class MyServiceImpl implements MyService {
  getData(): Promise<Data> {
    // Implementation
  }
}
```

## Best Practices

### 1. Keep Extensions Self-Contained

- All extension code should live within its directory
- Avoid modifying core application files
- If this is necessary, document why and provide a migration path
- Use dependency injection for integration points
- **Define service interfaces in the extension** for true dependency inversion

### 2. Follow Naming Conventions

- Extension directory: `kebab-case`
- Service IDs: `PascalCase` (e.g., `MyCustomService`)
- File names: Match the class/component name

### 3. Document Your Extension

Include a `docs/` directory with:
- Architecture overview
- API documentation
- Configuration guide
- Usage examples

### 4. Version Your Extensions

- Use semantic versioning (MAJOR.MINOR.PATCH)
- Document breaking changes
- Maintain backwards compatibility when possible

### 5. Handle Errors Gracefully

```typescript
try {
  // Extension logic
} catch (error) {
  this.logger.error({ error }, 'Extension operation failed');
  // Fallback or graceful degradation
}
```

### 6. Use TypeScript Interfaces

Define clear contracts for your services:

```typescript
// extensions/my-extension/services/MyService.d.ts
export interface MyService {
  doSomething(): Promise<void>;
  getSomething(id: string): Promise<SomeData>;
}
```

### 7. Test Your Extension

- Unit test services and utilities
- Integration test with the storefront
- Test with extension enabled and disabled

## Troubleshooting

### Extension Not Loading

1. Check `plugin.json` exists and is valid JSON
2. Verify `"enabled": true` in the manifest
3. Ensure extension directory name matches `"name"` field
4. Rebuild the application (`npm run build` or restart dev server)

### Dependency Injection Errors

1. Verify `@injectable` decorator is present on services
2. Check service ID matches what's being injected
3. Ensure dependencies are available in the DI container
4. Review alias configuration in `plugin.json`

### TypeScript Import Errors

1. Verify `@extensions/*` path is in `tsconfig.json`
2. Check component exports in `index.ts`
3. Restart TypeScript server in your IDE

### Build Errors

1. Run `npm run generate-di` to regenerate DI container
2. Check for TypeScript errors in extension code
3. Verify all dependencies are installed

## Creating Your First Extension

### Step 1: Create Directory Structure

```bash
mkdir -p extensions/my-extension/{components,services/impl,docs}
```

### Step 2: Create Manifest

```json
// extensions/my-extension/plugin.json
{
  "name": "my-extension",
  "description": "My custom extension",
  "version": "1.0.0",
  "enabled": true
}
```

### Step 3: Create a Service

```typescript
// extensions/my-extension/services/impl/MyServiceSSR.ts
import { injectable } from '@/platform/core/di/injectable';

@injectable('MyService', 'Singleton')
export class MyServiceSSR {
  async doSomething(): Promise<string> {
    return 'Hello from my extension!';
  }
}

export default MyServiceSSR;
```

### Step 4: Rebuild and Use

```bash
npm run generate-di
npm run dev
```

```typescript
// In your application code
import ssr from '@/platform/ssr';

const myService = ssr.get<MyService>('MyService');
const result = await myService.doSomething();
```

## Resources

- **Dependency Injection**: See `docs/dependency-injection.md`
- **Platform Architecture**: See `docs/layered-architecture.md`
- **DI Generator**: See `scripts/di-generator.ts`

## Contributing Extensions

When creating extensions for distribution:

1. Include comprehensive documentation
2. Provide example usage
3. Test with multiple storefront versions
4. Package as a `.zip` or `.tar.gz` archive
5. Include installation instructions
6. Specify any peer dependencies
